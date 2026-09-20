import type { RateLimitSettings } from '../types';

/** UTC hour bucket key: `yyyy-mm-ddTHH`. */
export function hourKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}`;
}

/** UTC day bucket key: `yyyy-mm-dd`. */
export function dayKeyUtc(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local calendar day key (YYYY-MM-DD) for stats - matches client date-fns format. */
export function dayKeyLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO week key matching client `RRRR-'W'II` approximately via UTC ISO week. */
export function weekKeyLocal(date: Date = new Date()): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function monthKeyLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Minute bucket for interactionsPerMinute. */
export function minuteKey(date: Date = new Date()): string {
  return `${hourKey(date)}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

export const DEFAULT_RATE_LIMITS: RateLimitSettings = {
  otpPerHour: 5,
  interactionsPerMinute: 20,
  interactionsPerHour: 50,
  interactionsPerDay: 200,
  requestsPerDay: 30,
  cooldownSec: 30,
  duplicateReactionCooldownSec: 30,
};

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: string;
  nextBucket: {
    otpHourKey?: string;
    otpHourCount?: number;
    interactionMinuteKey: string;
    interactionMinuteCount: number;
    interactionHourKey: string;
    interactionHourCount: number;
    interactionDayKey: string;
    interactionDayCount: number;
    lastReactionAt: number;
    lastReactionKey: string;
    perReaction: Record<string, { hourKey: string; count: number }>;
  };
}

/**
 * Pure rate-limit evaluation against a bucket snapshot.
 * Caller persists `nextBucket` inside a transaction.
 */
export function evaluateInteractionRateLimit(opts: {
  nowMs: number;
  settings: RateLimitSettings;
  reactionKey: string;
  existing: {
    interactionMinuteKey?: string;
    interactionMinuteCount?: number;
    interactionHourKey?: string;
    interactionHourCount?: number;
    interactionDayKey?: string;
    interactionDayCount?: number;
    lastReactionAt?: number;
    lastReactionKey?: string;
    perReaction?: Record<string, { hourKey: string; count: number }>;
  };
}): RateLimitCheckResult {
  const { nowMs, settings, reactionKey, existing } = opts;
  const now = new Date(nowMs);
  const mKey = minuteKey(now);
  const hKey = hourKey(now);
  const dKey = dayKeyUtc(now);

  const minuteCount =
    existing.interactionMinuteKey === mKey
      ? (existing.interactionMinuteCount ?? 0)
      : 0;
  const hourCount =
    existing.interactionHourKey === hKey
      ? (existing.interactionHourCount ?? 0)
      : 0;
  const dayCount =
    existing.interactionDayKey === dKey
      ? (existing.interactionDayCount ?? 0)
      : 0;

  const lastAt = existing.lastReactionAt ?? 0;
  const lastKey = existing.lastReactionKey ?? '';
  const generalCooldownMs = (settings.cooldownSec ?? 30) * 1000;
  const duplicateCooldownMs =
    (settings.duplicateReactionCooldownSec ?? settings.cooldownSec ?? 30) * 1000;

  // Global cooldown: any reaction within the window is blocked.
  if (lastAt > 0 && nowMs - lastAt < generalCooldownMs) {
    return {
      allowed: false,
      reason: 'Please wait before sending another reaction.',
      nextBucket: buildNext(
        mKey,
        minuteCount,
        hKey,
        hourCount,
        dKey,
        dayCount,
        lastAt,
        lastKey,
        existing.perReaction ?? {},
        nowMs,
      ),
    };
  }

  // Extra cooldown when repeating the exact same reaction.
  if (
    lastKey === reactionKey &&
    lastAt > 0 &&
    nowMs - lastAt < duplicateCooldownMs
  ) {
    return {
      allowed: false,
      reason: 'Duplicate reaction cooldown active.',
      nextBucket: buildNext(
        mKey,
        minuteCount,
        hKey,
        hourCount,
        dKey,
        dayCount,
        lastAt,
        lastKey,
        existing.perReaction ?? {},
        nowMs,
      ),
    };
  }

  if (minuteCount >= settings.interactionsPerMinute) {
    return {
      allowed: false,
      reason: 'Per-minute interaction limit reached.',
      nextBucket: buildNext(
        mKey,
        minuteCount,
        hKey,
        hourCount,
        dKey,
        dayCount,
        lastAt,
        lastKey,
        existing.perReaction ?? {},
        nowMs,
      ),
    };
  }

  if (hourCount >= settings.interactionsPerHour) {
    return {
      allowed: false,
      reason: 'Hourly interaction limit reached.',
      nextBucket: buildNext(
        mKey,
        minuteCount,
        hKey,
        hourCount,
        dKey,
        dayCount,
        lastAt,
        lastKey,
        existing.perReaction ?? {},
        nowMs,
      ),
    };
  }

  if (dayCount >= settings.interactionsPerDay) {
    return {
      allowed: false,
      reason: 'Daily interaction limit reached.',
      nextBucket: buildNext(
        mKey,
        minuteCount,
        hKey,
        hourCount,
        dKey,
        dayCount,
        lastAt,
        lastKey,
        existing.perReaction ?? {},
        nowMs,
      ),
    };
  }

  const perReaction = { ...(existing.perReaction ?? {}) };
  const pr = perReaction[reactionKey];
  const prCount = pr && pr.hourKey === hKey ? pr.count : 0;
  // Soft per-reaction hourly cap: half of hourly budget (min 10).
  const perReactionCap = Math.max(10, Math.floor(settings.interactionsPerHour / 2));
  if (prCount >= perReactionCap) {
    return {
      allowed: false,
      reason: 'Per-reaction hourly limit reached.',
      nextBucket: buildNext(
        mKey,
        minuteCount,
        hKey,
        hourCount,
        dKey,
        dayCount,
        lastAt,
        lastKey,
        perReaction,
        nowMs,
      ),
    };
  }

  perReaction[reactionKey] = { hourKey: hKey, count: prCount + 1 };

  return {
    allowed: true,
    nextBucket: buildNext(
      mKey,
      minuteCount + 1,
      hKey,
      hourCount + 1,
      dKey,
      dayCount + 1,
      nowMs,
      reactionKey,
      perReaction,
      nowMs,
    ),
  };
}

function buildNext(
  interactionMinuteKey: string,
  interactionMinuteCount: number,
  interactionHourKey: string,
  interactionHourCount: number,
  interactionDayKey: string,
  interactionDayCount: number,
  lastReactionAt: number,
  lastReactionKey: string,
  perReaction: Record<string, { hourKey: string; count: number }>,
  _updatedAt: number,
): RateLimitCheckResult['nextBucket'] {
  return {
    interactionMinuteKey,
    interactionMinuteCount,
    interactionHourKey,
    interactionHourCount,
    interactionDayKey,
    interactionDayCount,
    lastReactionAt,
    lastReactionKey,
    perReaction,
  };
}

export function evaluateOtpRateLimit(opts: {
  nowMs: number;
  otpPerHour: number;
  existing: { otpHourKey?: string; otpHourCount?: number };
}): { allowed: boolean; next: { otpHourKey: string; otpHourCount: number } } {
  const hKey = hourKey(new Date(opts.nowMs));
  const count =
    opts.existing.otpHourKey === hKey ? (opts.existing.otpHourCount ?? 0) : 0;
  if (count >= opts.otpPerHour) {
    return {
      allowed: false,
      next: { otpHourKey: hKey, otpHourCount: count },
    };
  }
  return {
    allowed: true,
    next: { otpHourKey: hKey, otpHourCount: count + 1 },
  };
}
