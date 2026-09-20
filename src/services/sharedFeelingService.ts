import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getCurrentUser } from '@/services/authService';
import { getDb } from '@/services/firebase';
import type { FeelingOverride, SharedFeeling } from '@/types/models';
import { AppError } from '@/utils/errors';

const CONNECTIONS = 'connections';
const MAX_SHARED = 40;

function requireUid(): string {
  const user = getCurrentUser();
  if (!user) {
    throw new AppError('auth/unauthenticated', 'Please sign in to continue.');
  }
  return user.uid;
}

function newId(): string {
  return `sf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Saves a custom banner (emoji + heading + optional subheading) on the
 * connection so both people can one-tap it forever.
 */
export async function addSharedFeeling(input: {
  connectionId: string;
  emoji: string;
  title: string;
  subtitle?: string;
}): Promise<SharedFeeling> {
  const uid = requireUid();
  const emoji = input.emoji.trim();
  const title = input.title.trim();
  const subtitle = input.subtitle?.trim() || undefined;
  if (!emoji) {
    throw new AppError('unknown', 'Pick an emoji for this feeling.');
  }
  if (!title || title.length < 2) {
    throw new AppError('unknown', 'Give this feeling a short heading.');
  }
  if (title.length > 40) {
    throw new AppError('unknown', 'Keep the heading under 40 characters.');
  }
  if (subtitle && subtitle.length > 60) {
    throw new AppError('unknown', 'Keep the subheading under 60 characters.');
  }

  const db = getDb();
  const ref = doc(db, CONNECTIONS, input.connectionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new AppError('connection/not-found', 'Connection not found.');
  }
  const data = snap.data();
  const userIds = (data.userIds as string[]) ?? [];
  if (!userIds.includes(uid) || data.status !== 'active') {
    throw new AppError('permission-denied', 'Not allowed.');
  }

  const existing = Array.isArray(data.sharedFeelings)
    ? (data.sharedFeelings as SharedFeeling[])
    : [];
  if (existing.length >= MAX_SHARED) {
    throw new AppError(
      'unknown',
      `You can save up to ${MAX_SHARED} custom feelings together.`,
    );
  }

  const dup = existing.find(
    (f) =>
      f.emoji === emoji &&
      f.title.trim().toLowerCase() === title.toLowerCase(),
  );
  if (dup) {
    return dup;
  }

  const feeling: SharedFeeling = {
    id: newId(),
    emoji,
    title,
    ...(subtitle ? { subtitle } : {}),
    createdByUserId: uid,
    createdAt: Date.now(),
  };

  await updateDoc(ref, {
    sharedFeelings: arrayUnion(feeling),
    updatedAt: serverTimestamp(),
  });

  return feeling;
}

export async function removeSharedFeeling(
  connectionId: string,
  feelingId: string,
): Promise<void> {
  const uid = requireUid();
  const db = getDb();
  const ref = doc(db, CONNECTIONS, connectionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new AppError('connection/not-found', 'Connection not found.');
  }
  const data = snap.data();
  const userIds = (data.userIds as string[]) ?? [];
  if (!userIds.includes(uid)) {
    throw new AppError('permission-denied', 'Not allowed.');
  }
  const existing = Array.isArray(data.sharedFeelings)
    ? (data.sharedFeelings as SharedFeeling[])
    : [];
  const next = existing.filter((f) => f.id !== feelingId);
  await updateDoc(ref, {
    sharedFeelings: next,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Customize a predefined feeling's emoji / title / description for this chat.
 */
export async function upsertFeelingOverride(input: {
  connectionId: string;
  reactionId: string | number;
  emoji: string;
  title: string;
  subtitle?: string;
}): Promise<void> {
  const uid = requireUid();
  const emoji = input.emoji.trim();
  const title = input.title.trim();
  const subtitle = input.subtitle?.trim() || undefined;
  if (!emoji) {
    throw new AppError('unknown', 'Pick an emoji.');
  }
  if (!title || title.length < 2) {
    throw new AppError('unknown', 'Give it a short title.');
  }
  if (title.length > 40) {
    throw new AppError('unknown', 'Keep the title under 40 characters.');
  }
  if (subtitle && subtitle.length > 80) {
    throw new AppError('unknown', 'Keep the description under 80 characters.');
  }

  const db = getDb();
  const ref = doc(db, CONNECTIONS, input.connectionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new AppError('connection/not-found', 'Connection not found.');
  }
  const data = snap.data();
  const userIds = (data.userIds as string[]) ?? [];
  if (!userIds.includes(uid) || data.status !== 'active') {
    throw new AppError('permission-denied', 'Not allowed.');
  }

  const key = String(input.reactionId);
  const prev =
    (data.feelingOverrides as Record<string, FeelingOverride> | undefined) ??
    {};
  const next = {
    ...prev,
    [key]: {
      emoji,
      title,
      ...(subtitle ? { subtitle } : {}),
    },
  };

  await updateDoc(ref, {
    feelingOverrides: next,
    updatedAt: serverTimestamp(),
  });
}
