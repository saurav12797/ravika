import type { PresenceStatus } from '@/types/models';
import { formatRelativeActive } from '@/utils/dates';

const ONLINE_MS = 2 * 60 * 1000;
const RECENTLY_MS = 15 * 60 * 1000;

export function derivePresenceStatus(
  lastActiveAt: number | null | undefined,
  now: number = Date.now(),
): PresenceStatus {
  if (lastActiveAt == null || Number.isNaN(lastActiveAt)) {
    return 'offline';
  }
  const delta = now - lastActiveAt;
  if (delta < ONLINE_MS) {
    return 'online';
  }
  if (delta < RECENTLY_MS) {
    return 'recently';
  }
  return 'offline';
}

export function describePresence(lastActiveAt: number | null | undefined): string {
  const status = derivePresenceStatus(lastActiveAt);
  if (status === 'online') {
    return 'Online';
  }
  if (status === 'recently') {
    return 'Active recently';
  }
  return formatRelativeActive(lastActiveAt);
}
