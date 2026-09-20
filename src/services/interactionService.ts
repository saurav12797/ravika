import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getReactionDefinition } from '@/constants/reactions';
import { getCurrentUser } from '@/services/authService';
import { getDb, getFirebaseFunctions } from '@/services/firebase';
import { toMillis } from '@/services/firestoreUtils';
import type {
  Interaction,
  PaginatedResult,
  ReactionType,
} from '@/types/models';
import { dayKey } from '@/utils/dates';
import { AppError } from '@/utils/errors';
import { pickFeelingMessage } from '@/utils/feelingMessages';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { useRecentFeelingsStore } from '@/stores/recentFeelingsStore';
import { useConnectionFeelingUsageStore } from '@/stores/connectionFeelingUsageStore';
import { useSentCountsStore } from '@/stores/sentCountsStore';
import { env } from '@/config/env';
import { notifyFeelingPush } from '@/services/notificationService';

const INTERACTIONS = 'interactions';
const CONNECTIONS = 'connections';

function mapInteraction(
  id: string,
  data: Record<string, unknown>,
): Interaction {
  return {
    id,
    connectionId: String(data.connectionId),
    fromUserId: String(data.fromUserId),
    toUserId: String(data.toUserId),
    reactionType: data.reactionType as ReactionType,
    customReactionId:
      data.customReactionId != null
        ? String(data.customReactionId)
        : undefined,
    emoji: String(data.emoji ?? ''),
    title: String(data.title ?? ''),
    message: String(data.message ?? ''),
    animationId:
      data.animationId != null ? String(data.animationId) : undefined,
    createdAt: toMillis(data.createdAt as Parameters<typeof toMillis>[0]),
    dayKey: String(data.dayKey ?? dayKey()),
  };
}

export interface SendReactionInput {
  connectionId: string;
  toUserId: string;
  reactionType: ReactionType;
  message?: string;
  customReactionId?: string;
  emoji?: string;
  title?: string;
  animationId?: string;
  /** Used for the outgoing celebration overlay. */
  toDisplayName?: string;
}

interface SendInteractionResponse {
  interactionId: string;
  interaction: Record<string, unknown>;
}

function isFunctionsUnavailable(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message).toLowerCase()
      : '';
  return (
    code.includes('not-found') ||
    code.includes('unavailable') ||
    code.includes('failed-precondition') ||
    code.includes('internal') ||
    message.includes('not found') ||
    message.includes('cors') ||
    message.includes('network') ||
    message.includes('billing') ||
    message.includes('cloud function')
  );
}

/**
 * Direct Firestore write when Cloud Functions are unavailable (Spark).
 * Single batched write — no pre-read — so emoji sends feel instant.
 */
async function sendReactionDirect(
  input: SendReactionInput & {
    fromUserId: string;
    emoji: string;
    title: string;
    message: string;
    animationId?: string;
  },
): Promise<Interaction> {
  const db = getDb();
  const connRef = doc(db, CONNECTIONS, input.connectionId);
  const now = Date.now();
  const ref = doc(collection(db, INTERACTIONS));
  const payload = {
    connectionId: input.connectionId,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    reactionType: input.reactionType,
    customReactionId: input.customReactionId ?? null,
    emoji: input.emoji,
    title: input.title,
    message: input.message,
    animationId: input.animationId ?? null,
    createdAt: now,
    dayKey: dayKey(now),
  };

  const batch = writeBatch(db);
  batch.set(ref, payload);
  batch.update(connRef, {
    lastInteractionAt: serverTimestamp(),
    interactionCount: increment(1),
    [`unreadCounts.${input.toUserId}`]: increment(1),
    updatedAt: serverTimestamp(),
    ...(input.reactionType === 2
      ? { missYouCount: increment(1) }
      : {}),
  });

  try {
    await batch.commit();
  } catch (err) {
    // Connection update may fail on stricter rules — still try interaction alone.
    try {
      await addDoc(collection(db, INTERACTIONS), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } catch (inner) {
      throw inner instanceof AppError
        ? inner
        : new AppError('unknown', 'Could not send that. Try again.', inner ?? err);
    }
  }

  return mapInteraction(ref.id, payload);
}

/**
 * Sends a feeling. On Spark (default) writes Firestore directly - avoids
 * Cloud Function 404/CORS lag. Set EXPO_PUBLIC_USE_CLOUD_FUNCTIONS=true when
 * Blaze Functions are deployed.
 */
export async function sendReaction(
  input: SendReactionInput,
): Promise<Interaction> {
  const user = getCurrentUser();
  if (!user) {
    throw new AppError('auth/unauthenticated', 'Please sign in to continue.');
  }

  const def =
    typeof input.reactionType === 'number'
      ? getReactionDefinition(input.reactionType)
      : getReactionDefinition(input.reactionType);

  if (def?.isMeta && !input.message && !input.customReactionId) {
    throw new AppError(
      'unknown',
      'Custom reactions need a message or custom reaction id.',
    );
  }

  const { toDisplayName, ...rest } = input;
  // Never persist meta catalog titles like "Create Custom Feeling".
  const resolvedTitle =
    input.title?.trim() ||
    (def?.isMeta
      ? input.message?.trim().slice(0, 40) || 'Custom feeling'
      : def?.title) ||
    'Reaction';
  // Predefined: always catalog emoji + a rotating sub-message (never title-only).
  const isPredefinedCatalog =
    !!def && !def.isMeta && !input.customReactionId;
  const resolvedEmoji = isPredefinedCatalog
    ? def.emoji
    : input.emoji ?? (def?.isMeta ? '💕' : def?.emoji) ?? '💫';
  // Prefer caller-picked message so UI + send stay in sync; else shuffle-pick once.
  const resolvedMessage = isPredefinedCatalog
    ? input.message?.trim() || pickFeelingMessage(def)
    : input.message?.trim() ||
      def?.defaultMessage ||
      resolvedTitle;

  const payload = {
    ...rest,
    fromUserId: user.uid,
    emoji: resolvedEmoji,
    title: resolvedTitle,
    message: resolvedMessage,
    animationId: input.animationId ?? def?.animationId,
  };

  let mapped: Interaction;

  if (env.useCloudFunctions) {
    try {
      const callable = httpsCallable<
        typeof payload,
        SendInteractionResponse
      >(getFirebaseFunctions(), 'sendInteraction');

      const result = await callable(payload);
      const data = result.data.interaction;
      mapped = mapInteraction(result.data.interactionId, data);
    } catch (error) {
      if (!isFunctionsUnavailable(error)) {
        throw error instanceof AppError
          ? error
          : new AppError(
              'unknown',
              'Could not send that. Try again.',
              error,
            );
      }
      mapped = await sendReactionDirect(payload);
    }
  } else {
    mapped = await sendReactionDirect(payload);
  }

  useRecentFeelingsStore.getState().record({
    reactionType: mapped.reactionType,
    emoji: mapped.emoji,
    title: mapped.title,
  });
  useConnectionFeelingUsageStore.getState().record(mapped.connectionId, {
    reactionType: mapped.reactionType,
    emoji: mapped.emoji,
    title: mapped.title,
    customFeelingId: mapped.customReactionId,
  });
  useSentCountsStore.getState().record(
    mapped.customReactionId
      ? `custom:${mapped.customReactionId}`
      : mapped.reactionType === 'custom' || mapped.reactionType === 'custom_text'
        ? `custom:${mapped.emoji}:${mapped.title}`
        : mapped.reactionType,
  );
  celebrateSend(mapped, toDisplayName);

  // Push in background — never block the send path.
  const fromName =
    useAuthStore.getState().profile?.displayName?.trim() ||
    toDisplayName?.trim() ||
    'Someone who loves you';
  void notifyFeelingPush({
    toUserId: mapped.toUserId,
    fromUserId: mapped.fromUserId,
    fromDisplayName: fromName,
    connectionId: mapped.connectionId,
    interactionId: mapped.id,
    reactionType: mapped.reactionType,
    emoji: mapped.emoji,
    title: mapped.title,
    message: mapped.message,
  });

  return mapped;
}

function celebrateSend(interaction: Interaction, toDisplayName?: string) {
  useUiStore.getState().showSentCelebration({
    id: interaction.id,
    emoji: interaction.emoji,
    title: interaction.title,
    toDisplayName: toDisplayName?.trim() || 'them',
    message: interaction.message,
  });
}

export function subscribeToInteractions(
  connectionId: string,
  onChange: (items: Interaction[]) => void,
  onError?: (error: Error) => void,
  pageSize = 40,
): Unsubscribe {
  const q = query(
    collection(getDb(), INTERACTIONS),
    where('connectionId', '==', connectionId),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );

  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => mapInteraction(d.id, d.data())));
    },
    (err) => onError?.(err),
  );
}

/**
 * Live feed of feelings sent TO this user across their connections.
 * Merges per-connection snapshots (works with existing indexes).
 */
export function subscribeToReceivedFeelings(
  userId: string,
  connectionIds: string[],
  onChange: (items: Interaction[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (connectionIds.length === 0) {
    onChange([]);
    return () => undefined;
  }

  const byConnection = new Map<string, Interaction[]>();
  const unsubs: Unsubscribe[] = [];

  const emit = () => {
    const merged = [...byConnection.values()]
      .flat()
      .filter((i) => i.toUserId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 60);
    onChange(merged);
  };

  for (const connectionId of connectionIds.slice(0, 12)) {
    const unsub = subscribeToInteractions(
      connectionId,
      (items) => {
        byConnection.set(connectionId, items);
        emit();
      },
      onError,
      30,
    );
    unsubs.push(unsub);
  }

  return () => {
    for (const u of unsubs) u();
  };
}

export async function getRecentActivity(
  connectionId: string,
  pageSize = 20,
  cursor?: DocumentSnapshot,
): Promise<PaginatedResult<Interaction>> {
  const constraints = [
    where('connectionId', '==', connectionId),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];

  const q = cursor
    ? query(
        collection(getDb(), INTERACTIONS),
        ...constraints,
        startAfter(cursor),
      )
    : query(collection(getDb(), INTERACTIONS), ...constraints);

  const snaps = await getDocs(q);
  const items = snaps.docs.map((d) => mapInteraction(d.id, d.data()));
  const last = snaps.docs[snaps.docs.length - 1];
  return {
    items,
    nextCursor: last?.id ?? null,
  };
}

export type FeelingBreakdown = {
  total: number;
  byReaction: Record<string, number>;
  /** Display labels for custom / non-catalog keys. */
  labels: Record<string, { emoji: string; title: string }>;
};

export type SentFeelingRange = {
  /** Inclusive start (epoch ms). */
  startAt: number;
  /** Exclusive end (epoch ms). */
  endAt: number;
};

function feelingStatKey(item: {
  reactionType: ReactionType | string | number;
  customReactionId?: string;
  emoji?: string;
  title?: string;
}): string {
  if (item.customReactionId) return `custom:${item.customReactionId}`;
  const type = String(item.reactionType);
  if (type === 'custom' || type === 'custom_text') {
    return `custom:${item.emoji ?? '💕'}:${item.title ?? 'Custom feeling'}`;
  }
  return type;
}

/**
 * Counts feelings this user sent in an optional date range.
 */
export async function getSentFeelingBreakdown(
  connectionIds: string[],
  fromUserId: string,
  range?: SentFeelingRange,
): Promise<FeelingBreakdown> {
  const byReaction: Record<string, number> = {};
  const labels: Record<string, { emoji: string; title: string }> = {};
  let total = 0;

  const inRange = (createdAt: number) => {
    if (!range) return true;
    return createdAt >= range.startAt && createdAt < range.endAt;
  };

  const add = (item: {
    reactionType: ReactionType | string | number;
    customReactionId?: string;
    emoji?: string;
    title?: string;
  }) => {
    const key = feelingStatKey(item);
    byReaction[key] = (byReaction[key] ?? 0) + 1;
    if (key.startsWith('custom:')) {
      labels[key] = {
        emoji: item.emoji ?? '💕',
        title: item.title?.trim() || 'Custom feeling',
      };
    }
    total += 1;
  };

  try {
    const q = query(
      collection(getDb(), INTERACTIONS),
      where('fromUserId', '==', fromUserId),
      orderBy('createdAt', 'desc'),
      limit(500),
    );
    const snaps = await getDocs(q);
    for (const d of snaps.docs) {
      const data = d.data();
      if (
        connectionIds.length > 0 &&
        !connectionIds.includes(String(data.connectionId))
      ) {
        continue;
      }
      const createdAt = toMillis(
        data.createdAt as Parameters<typeof toMillis>[0],
      );
      if (!inRange(createdAt)) continue;
      add({
        reactionType: data.reactionType as ReactionType,
        customReactionId: data.customReactionId as string | undefined,
        emoji: data.emoji as string | undefined,
        title: data.title as string | undefined,
      });
    }
    if (total > 0 || range) {
      return { total, byReaction, labels };
    }
  } catch {
    // Index may be missing - fall back below.
  }

  const byReactionScan: Record<string, number> = {};
  const labelsScan: Record<string, { emoji: string; title: string }> = {};
  let totalScan = 0;

  await Promise.all(
    connectionIds.map(async (connectionId) => {
      const page = await getRecentActivity(connectionId, 100);
      for (const item of page.items) {
        if (item.fromUserId !== fromUserId) continue;
        if (!inRange(item.createdAt)) continue;
        const key = feelingStatKey(item);
        byReactionScan[key] = (byReactionScan[key] ?? 0) + 1;
        if (key.startsWith('custom:')) {
          labelsScan[key] = {
            emoji: item.emoji ?? '💕',
            title: item.title?.trim() || 'Custom feeling',
          };
        }
        totalScan += 1;
      }
    }),
  );

  return totalScan > 0 || range
    ? { total: totalScan, byReaction: byReactionScan, labels: labelsScan }
    : { total, byReaction, labels };
}

export type SentFeelingMessage = {
  id: string;
  message: string;
  emoji: string;
  title: string;
  createdAt: number;
  connectionId: string;
};

/**
 * All messages this user sent for one feeling key in an optional date range
 * (newest first). Used when tapping a row in "what you've sent".
 */
export async function getSentFeelingMessages(
  connectionIds: string[],
  fromUserId: string,
  feelingKey: string,
  range?: SentFeelingRange,
  max = 80,
): Promise<SentFeelingMessage[]> {
  const inRange = (createdAt: number) => {
    if (!range) return true;
    return createdAt >= range.startAt && createdAt < range.endAt;
  };

  const matches = (item: {
    reactionType: ReactionType | string | number;
    customReactionId?: string;
    emoji?: string;
    title?: string;
  }) => feelingStatKey(item) === feelingKey;

  const out: SentFeelingMessage[] = [];

  try {
    const q = query(
      collection(getDb(), INTERACTIONS),
      where('fromUserId', '==', fromUserId),
      orderBy('createdAt', 'desc'),
      limit(500),
    );
    const snaps = await getDocs(q);
    for (const d of snaps.docs) {
      if (out.length >= max) break;
      const data = d.data();
      if (
        connectionIds.length > 0 &&
        !connectionIds.includes(String(data.connectionId))
      ) {
        continue;
      }
      const createdAt = toMillis(
        data.createdAt as Parameters<typeof toMillis>[0],
      );
      if (!inRange(createdAt)) continue;
      const item = {
        reactionType: data.reactionType as ReactionType,
        customReactionId: data.customReactionId as string | undefined,
        emoji: data.emoji as string | undefined,
        title: data.title as string | undefined,
      };
      if (!matches(item)) continue;
      out.push({
        id: d.id,
        message: String(data.message ?? data.title ?? ''),
        emoji: String(data.emoji ?? '💕'),
        title: String(data.title ?? 'Feeling'),
        createdAt,
        connectionId: String(data.connectionId ?? ''),
      });
    }
    if (out.length > 0) return out;
  } catch {
    // fall through to per-connection scan
  }

  await Promise.all(
    connectionIds.map(async (connectionId) => {
      const page = await getRecentActivity(connectionId, 100);
      for (const item of page.items) {
        if (item.fromUserId !== fromUserId) continue;
        if (!inRange(item.createdAt)) continue;
        if (!matches(item)) continue;
        out.push({
          id: item.id,
          message: item.message || item.title,
          emoji: item.emoji || '💕',
          title: item.title || 'Feeling',
          createdAt: item.createdAt,
          connectionId: item.connectionId,
        });
      }
    }),
  );

  return out
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max);
}

/**
 * Counts feelings for today from live interactions (works without Cloud
 * Functions dailyStats writers).
 */
export async function getTodayFeelingBreakdown(
  connectionIds: string[],
  options?: { fromUserId?: string },
): Promise<FeelingBreakdown> {
  const today = dayKey();
  const byReaction: Record<string, number> = {};
  const labels: Record<string, { emoji: string; title: string }> = {};
  let total = 0;

  await Promise.all(
    connectionIds.map(async (connectionId) => {
      const page = await getRecentActivity(connectionId, 60);
      for (const item of page.items) {
        if (item.dayKey !== today) continue;
        if (options?.fromUserId && item.fromUserId !== options.fromUserId) {
          continue;
        }
        const key = feelingStatKey(item);
        byReaction[key] = (byReaction[key] ?? 0) + 1;
        if (key.startsWith('custom:')) {
          labels[key] = {
            emoji: item.emoji ?? '💕',
            title: item.title?.trim() || 'Custom feeling',
          };
        }
        total += 1;
      }
    }),
  );

  return { total, byReaction, labels };
}

/** Breakdown for one connection (all time in recent window, or today only). */
export async function getConnectionFeelingBreakdown(
  connectionId: string,
  options?: { todayOnly?: boolean; fromUserId?: string },
): Promise<FeelingBreakdown> {
  const today = dayKey();
  const page = await getRecentActivity(connectionId, 80);
  const byReaction: Record<string, number> = {};
  const labels: Record<string, { emoji: string; title: string }> = {};
  let total = 0;
  for (const item of page.items) {
    if (options?.todayOnly && item.dayKey !== today) continue;
    if (options?.fromUserId && item.fromUserId !== options.fromUserId) {
      continue;
    }
    const key = feelingStatKey(item);
    byReaction[key] = (byReaction[key] ?? 0) + 1;
    if (key.startsWith('custom:')) {
      labels[key] = {
        emoji: item.emoji ?? '💕',
        title: item.title?.trim() || 'Custom feeling',
      };
    }
    total += 1;
  }
  return { total, byReaction, labels };
}
