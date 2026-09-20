import type { NotificationMode } from '../types';

export const GROUPING_WINDOW_OPTIONS_SEC = [30, 60, 120, 300, 600] as const;

export type GroupingWindowSeconds = (typeof GROUPING_WINDOW_OPTIONS_SEC)[number];

export interface NotificationGroupState {
  count: number;
  windowStartedAt: number;
  flushed?: boolean;
}

export type NotificationSendDecision =
  | { action: 'send_immediate'; count: 1 }
  | { action: 'send_grouped'; count: number }
  | { action: 'queue_only'; count: number };

/**
 * Pure decision for how to notify given mode + existing group window.
 *
 * - individual: always send immediately (count 1)
 * - grouped: accumulate; send rolling grouped push with count
 * - smart: first in window sends immediately; repeats within window send grouped
 */
export function decideNotificationSend(opts: {
  mode: NotificationMode;
  nowMs: number;
  windowMs: number;
  existing: NotificationGroupState | null;
}): NotificationSendDecision {
  const { mode, nowMs, windowMs, existing } = opts;

  if (mode === 'individual') {
    return { action: 'send_immediate', count: 1 };
  }

  const windowOpen =
    existing != null &&
    !existing.flushed &&
    nowMs - existing.windowStartedAt < windowMs;

  if (mode === 'grouped') {
    const count = windowOpen && existing ? existing.count + 1 : 1;
    return { action: 'send_grouped', count };
  }

  // smart
  if (windowOpen && existing) {
    return { action: 'send_grouped', count: existing.count + 1 };
  }
  return { action: 'send_immediate', count: 1 };
}

/** Resolve window ms from seconds (preferred) or legacy minutes. */
export function resolveGroupingWindowMs(settings: {
  groupingWindowSeconds?: number;
  batchWindowMinutes?: number;
}): number {
  if (
    typeof settings.groupingWindowSeconds === 'number' &&
    settings.groupingWindowSeconds > 0
  ) {
    return settings.groupingWindowSeconds * 1000;
  }
  const minutes = Math.max(1, settings.batchWindowMinutes ?? 2);
  return minutes * 60_000;
}

export function formatGroupedBody(
  baseBody: string,
  count: number,
  windowLabel?: string,
): string {
  if (count <= 1) {
    return baseBody;
  }
  if (windowLabel) {
    return `${baseBody.replace(/\s*$/, '')} ${count} times in the last ${windowLabel}`;
  }
  return `${baseBody} (×${count})`;
}

export function windowSecondsToLabel(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}
