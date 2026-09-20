import * as admin from 'firebase-admin';
import type {
  DeviceTokenDoc,
  NotificationMode,
  NotificationSettings,
} from '../types';
import {
  decideNotificationSend,
  formatGroupedBody,
  resolveGroupingWindowMs,
  windowSecondsToLabel,
} from './notificationGrouping';
import { buildNotificationBody } from './reactions';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export function notificationGroupId(
  recipientId: string,
  senderId: string,
  reactionKey: string,
): string {
  return `${recipientId}_${senderId}_${reactionKey}`;
}

interface GroupDoc {
  recipientId: string;
  senderId: string;
  reactionKey: string;
  count: number;
  windowStartedAt: number;
  lastBody: string;
  lastInteractionId: string;
  connectionId: string;
  flushed?: boolean;
}

/**
 * Resolve Expo push tokens for a user from:
 * 1. `userDevices/{uid}/tokens/*`
 * 2. fallback `users/{uid}.deviceTokens`
 */
export async function collectPushTokens(
  db: admin.firestore.Firestore,
  uid: string,
): Promise<string[]> {
  const tokens = new Set<string>();

  const deviceSnap = await db
    .collection('userDevices')
    .doc(uid)
    .collection('tokens')
    .get();

  for (const doc of deviceSnap.docs) {
    const data = doc.data() as Partial<DeviceTokenDoc>;
    if (data.token && data.token.startsWith('ExponentPushToken')) {
      tokens.add(data.token);
    } else if (typeof data.token === 'string' && data.token.length > 0) {
      tokens.add(data.token);
    }
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const deviceTokens = userSnap.data()?.deviceTokens;
  if (Array.isArray(deviceTokens)) {
    for (const t of deviceTokens) {
      if (typeof t === 'string' && t.length > 0) {
        tokens.add(t);
      }
    }
  }

  return [...tokens];
}

export async function sendExpoPush(
  messages: Array<{
    to: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    sound?: string;
  }>,
): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Expo push failed', res.status, text);
    }
  } catch (err) {
    console.error('Expo push error', err);
  }
}

function resolveMode(
  settings: NotificationSettings,
  userMode?: NotificationMode,
): NotificationMode {
  return userMode ?? settings.mode;
}

/**
 * Queue / send a reaction notification according to admin + user prefs.
 * Modes:
 * - individual: send immediately
 * - grouped: accumulate within window and send rolling grouped push
 * - smart: first immediate; repeats within window grouped
 */
export async function queueReactionNotification(opts: {
  db: admin.firestore.Firestore;
  recipientId: string;
  senderId: string;
  senderName: string;
  connectionId: string;
  interactionId: string;
  reactionKey: string;
  reactionType: string | number;
  emoji: string;
  title: string;
  message: string;
  settings: NotificationSettings;
  userMode?: NotificationMode;
  pushEnabled?: boolean;
  reactionNotifications?: boolean;
}): Promise<void> {
  const {
    db,
    recipientId,
    senderId,
    senderName,
    connectionId,
    interactionId,
    reactionKey,
    reactionType,
    emoji,
    title,
    message,
    settings,
  } = opts;

  if (opts.pushEnabled === false || opts.reactionNotifications === false) {
    return;
  }

  if (
    settings.enabledReactions &&
    settings.enabledReactions[String(reactionType)] === false
  ) {
    return;
  }

  const mode = resolveMode(settings, opts.userMode);
  const body = buildNotificationBody(senderName, reactionType, {
    emoji,
    title,
    message,
  });
  const windowMs = resolveGroupingWindowMs(settings);
  const windowLabel = windowSecondsToLabel(
    settings.groupingWindowSeconds ||
      Math.max(1, settings.batchWindowMinutes) * 60,
  );
  const now = Date.now();
  const groupRef = db
    .collection('notificationGroups')
    .doc(notificationGroupId(recipientId, senderId, reactionKey));

  const tokens = await collectPushTokens(db, recipientId);
  if (tokens.length === 0) {
    return;
  }

  const pushPayload = (pushBody: string) =>
    tokens.map((to) => ({
      to,
      title: 'Ravika',
      body: pushBody,
      sound: 'default',
      data: {
        type: 'interaction',
        connectionId,
        interactionId,
        senderId,
        reactionKey,
      },
    }));

  if (mode === 'individual') {
    await sendExpoPush(pushPayload(body));
    return;
  }

  let decision = decideNotificationSend({
    mode,
    nowMs: now,
    windowMs,
    existing: null,
  });

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(groupRef);
    const existing = snap.exists ? (snap.data() as GroupDoc) : null;
    decision = decideNotificationSend({
      mode,
      nowMs: now,
      windowMs,
      existing: existing
        ? {
            count: existing.count,
            windowStartedAt: existing.windowStartedAt,
            flushed: existing.flushed,
          }
        : null,
    });

    if (decision.action === 'send_immediate') {
      tx.set(groupRef, {
        recipientId,
        senderId,
        reactionKey,
        count: 1,
        windowStartedAt: now,
        lastBody: body,
        lastInteractionId: interactionId,
        connectionId,
        flushed: false,
        updatedAt: now,
      });
    } else {
      tx.set(
        groupRef,
        {
          recipientId,
          senderId,
          reactionKey,
          count: decision.count,
          windowStartedAt: existing?.windowStartedAt ?? now,
          lastBody: body,
          lastInteractionId: interactionId,
          connectionId,
          flushed: false,
          updatedAt: now,
        },
        { merge: true },
      );
    }
  });

  if (decision.action === 'send_immediate') {
    await sendExpoPush(pushPayload(body));
  } else if (decision.action === 'send_grouped') {
    const grouped = formatGroupedBody(body, decision.count, windowLabel);
    await sendExpoPush(pushPayload(grouped));
  }
}
