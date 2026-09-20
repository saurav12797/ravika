import { useEffect, useMemo } from 'react';
import {
  derivePresenceStatus,
  describePresence,
  startPresenceTracking,
} from '@/services/presenceService';
import type { PresenceStatus } from '@/types/models';
import { useAuthStore } from '@/stores/authStore';

export function usePresence(lastActiveAt?: number | null): {
  status: PresenceStatus;
  label: string;
} {
  const userId = useAuthStore((s) => s.user?.uid);
  const selfLastActive = useAuthStore((s) => s.profile?.lastActiveAt);
  const target = lastActiveAt ?? selfLastActive ?? null;

  useEffect(() => {
    if (!userId) {
      return;
    }
    return startPresenceTracking(userId);
  }, [userId]);

  return useMemo(
    () => ({
      status: derivePresenceStatus(target),
      label: describePresence(target),
    }),
    [target],
  );
}
