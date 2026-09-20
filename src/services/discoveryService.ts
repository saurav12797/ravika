import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '@/services/firebase';
import { getUserByPhone, getUserByUsername } from '@/services/userService';
import type { UserProfile } from '@/types/models';
import { hashPhones } from '@/utils/phone';

export async function findByUsername(
  username: string,
): Promise<UserProfile | null> {
  return getUserByUsername(username);
}

/**
 * Live suggestions while typing a username (prefix match, max 8).
 */
export async function suggestUsersByUsername(
  rawQuery: string,
  excludeUserId?: string,
): Promise<UserProfile[]> {
  const q = rawQuery.trim().toLowerCase().replace(/^@/, '');
  if (q.length < 2) {
    return [];
  }

  const snaps = await getDocs(
    query(
      collection(getDb(), 'users'),
      where('username', '>=', q),
      where('username', '<=', `${q}\uf8ff`),
      limit(8),
    ),
  );

  return snaps.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        phoneE164: String(data.phoneE164 ?? ''),
        phoneHash: String(data.phoneHash ?? ''),
        username: String(data.username ?? ''),
        displayName: String(data.displayName ?? ''),
        avatarUrl: data.avatarUrl != null ? String(data.avatarUrl) : undefined,
        bio: data.bio != null ? String(data.bio) : undefined,
        gender: data.gender as UserProfile['gender'],
        notificationPreferences: {
          pushEnabled: true,
          reactionNotifications: true,
          requestNotifications: true,
          milestoneNotifications: true,
          mode: 'smart' as const,
        },
        isAdmin: Boolean(data.isAdmin),
        lastActiveAt: 0,
        createdAt: 0,
        updatedAt: 0,
      } satisfies UserProfile;
    })
    .filter((u) => u.id !== excludeUserId && u.username.length > 0);
}

export async function findByPhone(phone: string): Promise<UserProfile | null> {
  return getUserByPhone(phone);
}

export interface ContactMatch {
  phoneHash: string;
  user: UserProfile;
}

interface MatchContactsResponse {
  matches: Array<{
    phoneHash: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  }>;
}

/**
 * Privacy-preserving contact matching:
 * 1. Normalize + SHA-256 hash phones on device (never upload raw numbers).
 * 2. Prefer callable `matchContactsByPhoneHashes` when available.
 * 3. Fall back to Firestore `phoneHash` queries in chunks of 10.
 */
export async function matchContactsByPhoneHashes(
  rawPhones: string[],
): Promise<ContactMatch[]> {
  const phoneHashes = await hashPhones(rawPhones);
  if (phoneHashes.length === 0) {
    return [];
  }

  try {
    const callable = httpsCallable<
      { phoneHashes: string[] },
      MatchContactsResponse
    >(getFirebaseFunctions(), 'matchContactsByPhoneHashes');
    const result = await callable({ phoneHashes });
    return result.data.matches.map((m) => ({
      phoneHash: m.phoneHash,
      user: {
        id: m.userId,
        phoneE164: '',
        phoneHash: m.phoneHash,
        username: m.username,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
        notificationPreferences: {
          pushEnabled: true,
          reactionNotifications: true,
          requestNotifications: true,
          milestoneNotifications: true,
          mode: 'smart',
        },
        isAdmin: false,
        lastActiveAt: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    }));
  } catch {
    return matchViaFirestore(phoneHashes);
  }
}

async function matchViaFirestore(phoneHashes: string[]): Promise<ContactMatch[]> {
  const matches: ContactMatch[] = [];
  const chunkSize = 10;

  for (let i = 0; i < phoneHashes.length; i += chunkSize) {
    const chunk = phoneHashes.slice(i, i + chunkSize);
    const q = query(
      collection(getDb(), 'users'),
      where('phoneHash', 'in', chunk),
      limit(chunkSize),
    );
    const snaps = await getDocs(q);
    for (const d of snaps.docs) {
      const data = d.data();
      matches.push({
        phoneHash: String(data.phoneHash),
        user: {
          id: d.id,
          phoneE164: '',
          phoneHash: String(data.phoneHash ?? ''),
          username: String(data.username ?? ''),
          displayName: String(data.displayName ?? ''),
          avatarUrl:
            data.avatarUrl != null ? String(data.avatarUrl) : undefined,
          bio: data.bio != null ? String(data.bio) : undefined,
          notificationPreferences: {
            pushEnabled: true,
            reactionNotifications: true,
            requestNotifications: true,
            milestoneNotifications: true,
            mode: 'smart',
          },
          isAdmin: false,
          lastActiveAt: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      });
    }
  }

  return matches;
}
