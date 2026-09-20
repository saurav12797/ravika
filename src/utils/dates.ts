import {
  differenceInDays,
  differenceInMinutes,
  format,
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
} from 'date-fns';

/** YYYY-MM-DD in local time for daily aggregation keys. */
export function dayKey(date: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function weekKey(date: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return format(d, "RRRR-'W'II");
}

export function monthKey(date: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return format(d, 'yyyy-MM');
}

export function parseDayKey(key: string): Date {
  return startOfDay(parseISO(key));
}

/** e.g. "Online", "Active 5m ago", "Last active yesterday" */
export function formatRelativeActive(lastActiveAt: number | null | undefined): string {
  if (lastActiveAt == null || Number.isNaN(lastActiveAt)) {
    return 'Last active unknown';
  }

  const minutes = differenceInMinutes(Date.now(), lastActiveAt);
  if (minutes < 2) {
    return 'Online';
  }
  if (minutes < 15) {
    return 'Active just now';
  }

  const date = new Date(lastActiveAt);
  if (isToday(date)) {
    return `Active ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
  }
  if (isYesterday(date)) {
    return 'Last active yesterday';
  }

  const days = differenceInDays(Date.now(), lastActiveAt);
  if (days < 7) {
    return `Last active ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
  }

  return `Last active ${format(date, 'MMM d')}`;
}

/** Compact activity timestamps for feed rows. */
export function formatActivityTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return `Yesterday ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, h:mm a');
}
