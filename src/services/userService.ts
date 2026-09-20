import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from '@/services/firebase';
import { toMillis } from '@/services/firestoreUtils';
import type {
  NotificationPreferences,
  UserProfile,
} from '@/types/models';
import { AppError } from '@/utils/errors';
import { hashPhone, normalizeToE164 } from '@/utils/phone';

const USERS = 'users';
const USERNAMES = 'usernames';

const LAST_ACTIVE_THROTTLE_MS = 2 * 60 * 1000;
const lastActiveWrites = new Map<string, number>();

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  reactionNotifications: true,
  requestNotifications: true,
  milestoneNotifications: true,
  mode: 'smart',
};

function mapUser(id: string, data: Record<string, unknown>): UserProfile {
  const prefs = (data.notificationPreferences ??
    DEFAULT_NOTIFICATION_PREFERENCES) as NotificationPreferences;

  return {
    id,
    phoneE164: String(data.phoneE164 ?? ''),
    phoneHash: String(data.phoneHash ?? ''),
    username: String(data.username ?? ''),
    displayName: String(data.displayName ?? ''),
    bio: data.bio != null ? String(data.bio) : undefined,
    avatarUrl: data.avatarUrl != null ? String(data.avatarUrl) : undefined,
    gender: data.gender as UserProfile['gender'],
    dateOfBirth:
      data.dateOfBirth != null ? String(data.dateOfBirth) : undefined,
    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...prefs,
    },
    isAdmin: Boolean(data.isAdmin),
    lastActiveAt: toMillis(
      data.lastActiveAt as Parameters<typeof toMillis>[0],
    ),
    createdAt: toMillis(data.createdAt as Parameters<typeof toMillis>[0]),
    updatedAt: toMillis(data.updatedAt as Parameters<typeof toMillis>[0]),
    deviceTokens: Array.isArray(data.deviceTokens)
      ? data.deviceTokens.map(String)
      : undefined,
  };
}

export async function getUser(userId: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getDb(), USERS, userId));
  if (!snap.exists()) {
    return null;
  }
  return mapUser(snap.id, snap.data());
}

export async function getUserByUsername(
  username: string,
): Promise<UserProfile | null> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const q = query(
    collection(getDb(), USERS),
    where('username', '==', normalized),
    limit(1),
  );
  const snaps = await getDocs(q);
  if (snaps.empty) {
    return null;
  }
  const first = snaps.docs[0];
  return mapUser(first.id, first.data());
}

export async function getUserByPhone(
  phoneE164: string,
): Promise<UserProfile | null> {
  const normalized = normalizeToE164(phoneE164);
  const phoneHash = await hashPhone(normalized);
  const q = query(
    collection(getDb(), USERS),
    where('phoneHash', '==', phoneHash),
    limit(1),
  );
  const snaps = await getDocs(q);
  if (snaps.empty) {
    return null;
  }
  const first = snaps.docs[0];
  return mapUser(first.id, first.data());
}

export type CreateProfileInput = {
  id: string;
  /** Optional when signing in with Google / email. */
  phoneE164?: string;
  email?: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  gender?: UserProfile['gender'];
  dateOfBirth?: string;
  notificationPreferences?: Partial<NotificationPreferences>;
};

export async function createProfile(
  input: CreateProfileInput,
): Promise<UserProfile> {
  const username = input.username.trim().toLowerCase();
  const available = await checkUsernameAvailable(username);
  if (!available) {
    throw new AppError('user/username-taken', 'That username is already taken.');
  }

  let phoneE164 = '';
  let phoneHash = '';
  const rawPhone = input.phoneE164?.trim() ?? '';
  if (rawPhone) {
    phoneE164 = normalizeToE164(rawPhone);
    phoneHash = await hashPhone(phoneE164);
  }

  const now = Date.now();
  const profile: UserProfile = {
    id: input.id,
    phoneE164,
    phoneHash,
    username,
    displayName: input.displayName.trim(),
    bio: input.bio?.trim() || undefined,
    avatarUrl: input.avatarUrl || undefined,
    gender: input.gender,
    dateOfBirth: input.dateOfBirth,
    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...input.notificationPreferences,
    },
    isAdmin: false,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
  };

  // Firestore rejects `undefined` field values - only write defined keys.
  const payload: Record<string, unknown> = {
    phoneE164: profile.phoneE164,
    phoneHash: profile.phoneHash,
    username: profile.username,
    displayName: profile.displayName,
    notificationPreferences: profile.notificationPreferences,
    isAdmin: false,
    email: input.email?.trim().toLowerCase() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  };
  if (profile.bio) payload.bio = profile.bio;
  if (profile.avatarUrl) payload.avatarUrl = profile.avatarUrl;
  if (profile.gender) payload.gender = profile.gender;
  if (profile.dateOfBirth) payload.dateOfBirth = profile.dateOfBirth;

  const db = getDb();
  await setDoc(doc(db, USERS, profile.id), payload);
  await setDoc(doc(db, USERNAMES, username), {
    userId: profile.id,
    createdAt: serverTimestamp(),
  });

  return profile;
}

export type UpdateProfileInput = Partial<
  Pick<
    UserProfile,
    | 'displayName'
    | 'username'
    | 'bio'
    | 'avatarUrl'
    | 'gender'
    | 'dateOfBirth'
    | 'notificationPreferences'
  >
>;

export async function updateProfile(
  userId: string,
  patch: UpdateProfileInput,
): Promise<UserProfile> {
  const db = getDb();
  const ref = doc(db, USERS, userId);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    throw new AppError('user/not-found', 'User not found.');
  }

  const current = mapUser(existing.id, existing.data());
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.displayName !== undefined) {
    const name = patch.displayName.trim();
    if (!name) {
      throw new AppError('user/invalid', 'Add your name.');
    }
    payload.displayName = name;
  }

  if (patch.bio !== undefined) {
    const bio = patch.bio.trim();
    payload.bio = bio || null;
  }

  if (patch.avatarUrl !== undefined) {
    payload.avatarUrl = patch.avatarUrl || null;
  }

  if (patch.gender !== undefined) {
    payload.gender = patch.gender || null;
  }

  if (patch.dateOfBirth !== undefined) {
    payload.dateOfBirth = patch.dateOfBirth || null;
  }

  if (patch.notificationPreferences !== undefined) {
    payload.notificationPreferences = patch.notificationPreferences;
  }

  if (patch.username !== undefined) {
    const nextUsername = patch.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(nextUsername)) {
      throw new AppError(
        'user/invalid',
        'Username must be 3-20 letters, numbers, or underscore.',
      );
    }
    if (nextUsername !== current.username) {
      const available = await checkUsernameAvailable(nextUsername);
      if (!available) {
        throw new AppError(
          'user/username-taken',
          'That username is already taken.',
        );
      }
      payload.username = nextUsername;
      await setDoc(doc(db, USERNAMES, nextUsername), {
        userId,
        createdAt: serverTimestamp(),
      });
      // Best-effort cleanup of the old handle.
      try {
        await deleteDoc(doc(db, USERNAMES, current.username));
      } catch {
        // Non-fatal if old handle cleanup fails.
      }
    }
  }

  await updateDoc(ref, payload);

  const updated = await getUser(userId);
  if (!updated) {
    throw new AppError('user/not-found', 'User not found.');
  }
  return updated;
}

/** Throttled presence heartbeat - at most once per 2 minutes per user. */
export async function updateLastActive(userId: string): Promise<void> {
  const now = Date.now();
  const last = lastActiveWrites.get(userId) ?? 0;
  if (now - last < LAST_ACTIVE_THROTTLE_MS) {
    return;
  }
  lastActiveWrites.set(userId, now);

  try {
    const ref = doc(getDb(), USERS, userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return;
    }
    await updateDoc(ref, {
      lastActiveAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal during first login before profile exists.
  }
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    return false;
  }
  const snap = await getDoc(doc(getDb(), USERNAMES, normalized));
  return !snap.exists();
}

export function subscribeToUser(
  userId: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), USERS, userId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(mapUser(snap.id, snap.data()));
    },
    (error) => {
      onError?.(error);
    },
  );
}
