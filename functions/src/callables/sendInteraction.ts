import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  getDb,
  loadAdminSettings,
  requireAuth,
} from '../helpers/admin';
import { checkAndRecordMilestones } from '../helpers/milestones';
import { queueReactionNotification } from '../helpers/notifications';
import {
  dayKeyLocal,
  evaluateInteractionRateLimit,
  monthKeyLocal,
  weekKeyLocal,
} from '../helpers/rateLimits';
import {
  getReactionDefinition,
  getReactionMessage,
  parseReactionType,
} from '../helpers/reactions';
import type { ConnectionDoc, ReactionType, UserDoc } from '../types';

interface SendInteractionInput {
  connectionId: string;
  toUserId: string;
  reactionType: ReactionType | string | number;
  message?: string;
  customReactionId?: string;
  customText?: string;
  emoji?: string;
  title?: string;
  animationId?: string;
  fromUserId?: string;
  /** Spec alias - mapped to reactionType when present. */
  reactionId?: ReactionType | string | number;
}

interface SendInteractionResult {
  interactionId: string;
  delivered: true;
  interaction: Record<string, unknown>;
}

function reactionKeyOf(
  reactionType: ReactionType,
  customReactionId?: string,
): string {
  if (customReactionId) {
    return `custom:${customReactionId}`;
  }
  return String(reactionType);
}

export const sendInteraction = onCall(
  { cors: true },
  async (request): Promise<SendInteractionResult> => {
    const uid = requireAuth(request.auth?.uid);
    const data = request.data as SendInteractionInput;

    if (!data?.connectionId || typeof data.connectionId !== 'string') {
      throw new HttpsError('invalid-argument', 'connectionId is required.');
    }
    if (!data?.toUserId || typeof data.toUserId !== 'string') {
      throw new HttpsError('invalid-argument', 'toUserId is required.');
    }

    const rawType = data.reactionType ?? data.reactionId;
    const reactionType = parseReactionType(rawType);
    if (reactionType == null) {
      throw new HttpsError('invalid-argument', 'Invalid reactionType.');
    }

    if (data.fromUserId && data.fromUserId !== uid) {
      throw new HttpsError(
        'permission-denied',
        'fromUserId must match the authenticated user.',
      );
    }

    if (data.toUserId === uid) {
      throw new HttpsError(
        'invalid-argument',
        'Cannot send an interaction to yourself.',
      );
    }

    const db = getDb();
    const settings = await loadAdminSettings(db);

    if (settings.maintenanceMode) {
      throw new HttpsError('unavailable', 'Ravika is under maintenance.');
    }

    const enabledKey = String(reactionType);
    if (settings.enabledReactions?.[enabledKey] === false) {
      throw new HttpsError('failed-precondition', 'This reaction is disabled.');
    }

    if (
      (reactionType === 'custom' || reactionType === 'custom_text') &&
      !settings.featureFlags.customReactions
    ) {
      throw new HttpsError(
        'failed-precondition',
        'Custom reactions are disabled.',
      );
    }

    const def = getReactionDefinition(reactionType);
    const customText =
      typeof data.customText === 'string' ? data.customText.trim() : undefined;
    const message =
      (typeof data.message === 'string' ? data.message.trim() : undefined) ||
      customText ||
      (def && !def.isMeta ? getReactionMessage(reactionType) : undefined) ||
      def?.defaultMessage ||
      '';

    if (def?.isMeta && !message && !data.customReactionId) {
      throw new HttpsError(
        'invalid-argument',
        'Custom reactions need a message or customReactionId.',
      );
    }

    let emoji = data.emoji ?? (def?.isMeta ? '💕' : def?.emoji) ?? '💫';
    let title =
      (typeof data.title === 'string' && data.title.trim()) ||
      (def?.isMeta
        ? (message || '').slice(0, 40) || 'Custom feeling'
        : def?.title) ||
      'Reaction';
    let animationId = data.animationId ?? def?.animationId;

    if (data.customReactionId) {
      const customSnap = await db
        .collection('customReactions')
        .doc(uid)
        .collection('items')
        .doc(data.customReactionId)
        .get();
      if (customSnap.exists) {
        const c = customSnap.data() as {
          emoji?: string;
          title?: string;
          defaultMessage?: string;
          animationId?: string;
        };
        emoji = data.emoji ?? c.emoji ?? emoji;
        title = data.title ?? c.title ?? title;
        animationId = data.animationId ?? c.animationId ?? animationId;
      }
    }

    const connectionRef = db.collection('connections').doc(data.connectionId);
    const bucketRef = db.collection('rateLimitBuckets').doc(uid);
    const interactionRef = db.collection('interactions').doc();
    const nowMs = Date.now();
    const nowTs = admin.firestore.Timestamp.fromMillis(nowMs);
    const dKey = dayKeyLocal(new Date(nowMs));
    const wKey = weekKeyLocal(new Date(nowMs));
    const mKey = monthKeyLocal(new Date(nowMs));
    const rKey = reactionKeyOf(reactionType, data.customReactionId);

    const dailyRef = db
      .collection('dailyStats')
      .doc(`${data.connectionId}_${dKey}`);
    const weeklyRef = db
      .collection('weeklyStats')
      .doc(`${data.connectionId}_${wKey}`);
    const monthlyRef = db
      .collection('monthlyStats')
      .doc(`${data.connectionId}_${mKey}`);

    // Pre-read stats docs so the transaction can update them race-safely.
    const txResult = await db.runTransaction(async (tx) => {
      const [connSnap, bucketSnap, dailySnap, weeklySnap] = await Promise.all([
        tx.get(connectionRef),
        tx.get(bucketRef),
        tx.get(dailyRef),
        tx.get(weeklyRef),
      ]);

      if (!connSnap.exists) {
        throw new HttpsError('not-found', 'Connection not found.');
      }
      const conn = connSnap.data() as ConnectionDoc;
      if (conn.status !== 'active') {
        throw new HttpsError(
          'failed-precondition',
          'Connection is not active.',
        );
      }
      if (!conn.userIds.includes(uid) || !conn.userIds.includes(data.toUserId)) {
        throw new HttpsError(
          'permission-denied',
          'Not a participant of this connection.',
        );
      }

      const bucket = bucketSnap.exists
        ? (bucketSnap.data() as Parameters<
            typeof evaluateInteractionRateLimit
          >[0]['existing'])
        : {};

      const rate = evaluateInteractionRateLimit({
        nowMs,
        settings: settings.rateLimits,
        reactionKey: rKey,
        existing: bucket,
      });

      if (!rate.allowed) {
        throw new HttpsError(
          'resource-exhausted',
          rate.reason ?? 'Rate limit exceeded.',
        );
      }

      const interaction = {
        connectionId: data.connectionId,
        fromUserId: uid,
        toUserId: data.toUserId,
        reactionType,
        customReactionId: data.customReactionId ?? null,
        emoji,
        title,
        message,
        animationId: animationId ?? null,
        createdAt: nowTs,
        dayKey: dKey,
      };

      tx.set(interactionRef, interaction);
      tx.set(
        bucketRef,
        {
          ...rate.nextBucket,
          updatedAt: nowMs,
        },
        { merge: true },
      );

      const unread = { ...(conn.unreadCounts ?? {}) };
      unread[data.toUserId] = (unread[data.toUserId] ?? 0) + 1;
      const nextCount = (conn.interactionCount ?? 0) + 1;
      const prevMissYou = Number(
        (connSnap.data() as { missYouCount?: number }).missYouCount ?? 0,
      );
      const nextMissYou = reactionType === 1 ? prevMissYou + 1 : prevMissYou;

      const connUpdate: Record<string, unknown> = {
        lastInteractionAt: nowTs,
        interactionCount: nextCount,
        unreadCounts: unread,
        updatedAt: nowTs,
      };
      if (reactionType === 1) {
        connUpdate.missYouCount = nextMissYou;
      }
      tx.update(connectionRef, connUpdate);

      const reactionField = String(reactionType);
      const dailyData = (dailySnap.data() ?? {}) as {
        totalCount?: number;
        byReaction?: Record<string, number>;
        bySender?: Record<string, number>;
      };
      const weeklyData = (weeklySnap.data() ?? {}) as {
        totalCount?: number;
        streakDays?: number;
        byReaction?: Record<string, number>;
        bySender?: Record<string, number>;
      };
      const dailyTotal = Number(dailyData.totalCount ?? 0) + 1;
      const weeklyTotal = Number(weeklyData.totalCount ?? 0) + 1;
      const prevStreak = Number(weeklyData.streakDays ?? 0);
      // First interaction of the day advances streak by 1.
      const streakDays =
        Number(dailyData.totalCount ?? 0) === 0
          ? prevStreak + 1
          : Math.max(prevStreak, 1);

      tx.set(
        dailyRef,
        {
          connectionId: data.connectionId,
          dayKey: dKey,
          totalCount: dailyTotal,
          [`byReaction.${reactionField}`]:
            Number(dailyData.byReaction?.[reactionField] ?? 0) + 1,
          [`bySender.${uid}`]: Number(dailyData.bySender?.[uid] ?? 0) + 1,
          updatedAt: nowMs,
        },
        { merge: true },
      );

      tx.set(
        weeklyRef,
        {
          connectionId: data.connectionId,
          weekKey: wKey,
          totalCount: weeklyTotal,
          streakDays,
          [`byReaction.${reactionField}`]:
            Number(weeklyData.byReaction?.[reactionField] ?? 0) + 1,
          [`bySender.${uid}`]: Number(weeklyData.bySender?.[uid] ?? 0) + 1,
          updatedAt: nowMs,
        },
        { merge: true },
      );

      tx.set(
        monthlyRef,
        {
          connectionId: data.connectionId,
          monthKey: mKey,
          totalCount: admin.firestore.FieldValue.increment(1),
          [`byReaction.${reactionField}`]:
            admin.firestore.FieldValue.increment(1),
          [`bySender.${uid}`]: admin.firestore.FieldValue.increment(1),
          updatedAt: nowMs,
        },
        { merge: true },
      );

      for (const member of conn.userIds) {
        const userDaily = db.collection('dailyStats').doc(`${member}_${dKey}`);
        tx.set(
          userDaily,
          {
            userId: member,
            dayKey: dKey,
            totalCount: admin.firestore.FieldValue.increment(1),
            updatedAt: nowMs,
          },
          { merge: true },
        );
      }

      return {
        interaction,
        totalInteractions: nextCount,
        missYouCount: nextMissYou,
        streakDays,
        memberIds: conn.userIds as [string, string],
      };
    });

    if (settings.featureFlags.milestones) {
      await checkAndRecordMilestones({
        db,
        connectionId: data.connectionId,
        memberIds: txResult.memberIds,
        totalInteractions: txResult.totalInteractions,
        missYouCount: txResult.missYouCount,
        streakDays: txResult.streakDays,
        nowMs,
      });
    }

    const senderSnap = await db.collection('users').doc(uid).get();
    const recipientSnap = await db.collection('users').doc(data.toUserId).get();
    const sender = (senderSnap.data() ?? {}) as UserDoc;
    const recipient = (recipientSnap.data() ?? {}) as UserDoc;
    const senderName =
      sender.displayName?.trim() || sender.username?.trim() || 'Someone';

    await queueReactionNotification({
      db,
      recipientId: data.toUserId,
      senderId: uid,
      senderName,
      connectionId: data.connectionId,
      interactionId: interactionRef.id,
      reactionKey: rKey,
      reactionType,
      emoji,
      title,
      message,
      settings: settings.notifications,
      userMode: recipient.notificationPreferences?.mode,
      pushEnabled: recipient.notificationPreferences?.pushEnabled,
      reactionNotifications:
        recipient.notificationPreferences?.reactionNotifications,
    });

    const interactionOut: Record<string, unknown> = {
      connectionId: txResult.interaction.connectionId,
      fromUserId: txResult.interaction.fromUserId,
      toUserId: txResult.interaction.toUserId,
      reactionType: txResult.interaction.reactionType,
      emoji: txResult.interaction.emoji,
      title: txResult.interaction.title,
      message: txResult.interaction.message,
      createdAt: nowMs,
      dayKey: txResult.interaction.dayKey,
    };
    if (data.customReactionId) {
      interactionOut.customReactionId = data.customReactionId;
    }
    if (animationId) {
      interactionOut.animationId = animationId;
    }

    return {
      interactionId: interactionRef.id,
      delivered: true,
      interaction: interactionOut,
    };
  },
);
