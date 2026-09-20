import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDb } from '@/services/firebase';
import {
  derivePresenceStatus,
  describePresence,
} from '@/utils/presence';

export { derivePresenceStatus, describePresence };

const WRITE_THROTTLE_MS = 2 * 60 * 1000;

const lastOnlineWriteByUser = new Map<string, number>();
const subscriptions = new Map<string, NativeEventSubscription>();

/** Write online heartbeat at most every 2 minutes (only if profile exists). */
export async function markOnline(userId: string): Promise<void> {
  const now = Date.now();
  const last = lastOnlineWriteByUser.get(userId) ?? 0;
  if (now - last < WRITE_THROTTLE_MS) {
    return;
  }
  lastOnlineWriteByUser.set(userId, now);

  try {
    const ref = doc(getDb(), 'users', userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // New Google/phone user before profile-setup - nothing to update yet.
      return;
    }
    await updateDoc(ref, {
      lastActiveAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal (offline / rules / race during first login).
  }
}

export async function markOffline(userId: string): Promise<void> {
  void userId;
}

/**
 * Track AppState and mark online when active.
 * Returns an unsubscribe that removes the AppState listener.
 */
export function startPresenceTracking(userId: string): () => void {
  stopPresenceTracking(userId);

  const onChange = (state: AppStateStatus) => {
    if (state === 'active') {
      void markOnline(userId);
    }
  };

  void markOnline(userId);
  const sub = AppState.addEventListener('change', onChange);
  subscriptions.set(userId, sub);

  return () => {
    stopPresenceTracking(userId);
  };
}

export function stopPresenceTracking(userId: string): void {
  const sub = subscriptions.get(userId);
  if (sub) {
    sub.remove();
    subscriptions.delete(userId);
  }
  void markOffline(userId);
}
