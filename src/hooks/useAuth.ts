import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { isFirebaseConfigured, getFirebaseAuth } from '@/services/firebase';
import * as authService from '@/services/authService';
import { getUser, subscribeToUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';

let authListenerStarted = false;

/**
 * Attach Firebase Auth + profile listeners once for the whole app.
 */
function startAuthListener(): void {
  if (authListenerStarted || !isFirebaseConfigured) {
    if (!isFirebaseConfigured) {
      useAuthStore.getState().hydrate(null, null);
    }
    return;
  }
  authListenerStarted = true;

  let profileUnsub: (() => void) | undefined;

  try {
    onAuthStateChanged(getFirebaseAuth(), async (nextUser) => {
      profileUnsub?.();
      profileUnsub = undefined;

      const { hydrate, setProfile, setLoading } = useAuthStore.getState();

      if (!nextUser) {
        hydrate(null, null);
        return;
      }

      setLoading(true);
      try {
        await nextUser.reload();
        const nextProfile = await getUser(nextUser.uid);
        hydrate(nextUser, nextProfile);
        profileUnsub = subscribeToUser(nextUser.uid, (live) => {
          setProfile(live);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const deadAccount =
          /user-not-found|user-disabled|invalid-user|no user/i.test(msg);
        if (deadAccount) {
          try {
            await authService.signOut();
          } catch {
            // ignore
          }
          hydrate(null, null);
        } else {
          console.warn('[auth] profile hydrate soft-fail', err);
          hydrate(nextUser, null);
        }
      }
    });
  } catch (err) {
    console.warn('[auth] failed to attach auth listener', err);
    useAuthStore.getState().hydrate(null, null);
  }
}

/**
 * Subscribes to Firebase Auth and keeps the auth store + profile in sync.
 * Never lets auth/profile errors crash the root tree.
 */
export function useAuth(): {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  profile: ReturnType<typeof useAuthStore.getState>['profile'];
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
} {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    startAuthListener();
  }, []);

  return { user, profile, isLoading, isAuthenticated, logout };
}
