import {
  decideNotificationSend,
  formatGroupedBody,
  resolveGroupingWindowMs,
  windowSecondsToLabel,
} from '../../functions/src/helpers/notificationGrouping';
import {
  DEFAULT_RATE_LIMITS,
  evaluateInteractionRateLimit,
  evaluateOtpRateLimit,
} from '../../functions/src/helpers/rateLimits';
import { buildNotificationBody } from '../utils/notifications';
import { canPinConnection, assignPinOrders } from '../utils/pins';
import { derivePresenceStatus } from '../utils/presence';
import {
  isValidPhone,
  normalizeToE164,
  formatPhoneDisplay,
} from '../utils/phone';

describe('phone utils', () => {
  it('normalizes and validates E.164 numbers', () => {
    expect(normalizeToE164('+1 (415) 555-2671')).toBe('+14155552671');
    expect(isValidPhone('+14155552671')).toBe(true);
    expect(isValidPhone('not-a-phone')).toBe(false);
  });

  it('formats for display', () => {
    const formatted = formatPhoneDisplay('+14155552671');
    expect(formatted.length).toBeGreaterThan(4);
    expect(formatted).toContain('415');
  });
});

describe('notification body', () => {
  it('builds miss-you style copy from reaction template', () => {
    const body = buildNotificationBody('Saurav', 2);
    expect(body.toLowerCase()).toMatch(/saurav/);
    expect(body.length).toBeGreaterThan(5);
  });

  it('appends relationship context when provided', () => {
    const body = buildNotificationBody('Saurav', 1, 'girlfriend');
    expect(body).toMatch(/Girlfriend|girlfriend|❤️|Girlfriend/i);
  });
});

describe('presence', () => {
  const now = 1_700_000_000_000;

  it('marks online within 2 minutes', () => {
    expect(derivePresenceStatus(now - 60_000, now)).toBe('online');
  });

  it('marks recently within 15 minutes', () => {
    expect(derivePresenceStatus(now - 5 * 60_000, now)).toBe('recently');
  });

  it('marks offline after 15 minutes', () => {
    expect(derivePresenceStatus(now - 20 * 60_000, now)).toBe('offline');
  });
});

describe('pins', () => {
  it('allows up to 2 pins', () => {
    expect(canPinConnection(0)).toBe(true);
    expect(canPinConnection(1)).toBe(true);
    expect(canPinConnection(2)).toBe(false);
  });

  it('assigns pin order from list', () => {
    expect(assignPinOrders(['a', 'b'])).toEqual({ a: 0, b: 1 });
  });
});

describe('rate limits', () => {
  const baseExisting = {
    interactionMinuteKey: '',
    interactionMinuteCount: 0,
    interactionHourKey: '',
    interactionHourCount: 0,
    interactionDayKey: '',
    interactionDayCount: 0,
    lastReactionAt: 0,
    lastReactionKey: '',
    perReaction: {},
  };

  it('enforces general cooldown between reactions', () => {
    const now = Date.now();
    const blocked = evaluateInteractionRateLimit({
      nowMs: now,
      settings: { ...DEFAULT_RATE_LIMITS, cooldownSec: 30 },
      reactionKey: 'love',
      existing: {
        ...baseExisting,
        lastReactionAt: now - 5_000,
        lastReactionKey: 'miss',
      },
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/wait/i);
  });

  it('allows after cooldown elapsed', () => {
    const now = Date.now();
    const ok = evaluateInteractionRateLimit({
      nowMs: now,
      settings: { ...DEFAULT_RATE_LIMITS, cooldownSec: 30 },
      reactionKey: 'love',
      existing: {
        ...baseExisting,
        lastReactionAt: now - 31_000,
        lastReactionKey: 'miss',
      },
    });
    expect(ok.allowed).toBe(true);
  });

  it('enforces hourly limit', () => {
    const now = Date.now();
    const hourKey = new Date(now).toISOString().slice(0, 13); // approximate - use helper result
    const first = evaluateInteractionRateLimit({
      nowMs: now,
      settings: { ...DEFAULT_RATE_LIMITS, interactionsPerHour: 2, cooldownSec: 0, duplicateReactionCooldownSec: 0 },
      reactionKey: 'hug',
      existing: baseExisting,
    });
    expect(first.allowed).toBe(true);

    const blocked = evaluateInteractionRateLimit({
      nowMs: now,
      settings: { ...DEFAULT_RATE_LIMITS, interactionsPerHour: 2, cooldownSec: 0, duplicateReactionCooldownSec: 0 },
      reactionKey: 'kiss',
      existing: {
        ...baseExisting,
        interactionHourKey: first.nextBucket.interactionHourKey,
        interactionHourCount: 2,
        interactionMinuteKey: first.nextBucket.interactionMinuteKey,
        interactionMinuteCount: 0,
        interactionDayKey: first.nextBucket.interactionDayKey,
        interactionDayCount: 2,
      },
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/Hourly/i);
    void hourKey;
  });

  it('enforces daily limit', () => {
    const now = Date.now();
    const first = evaluateInteractionRateLimit({
      nowMs: now,
      settings: {
        ...DEFAULT_RATE_LIMITS,
        interactionsPerDay: 1,
        interactionsPerHour: 100,
        cooldownSec: 0,
        duplicateReactionCooldownSec: 0,
      },
      reactionKey: 'hi',
      existing: baseExisting,
    });
    expect(first.allowed).toBe(true);

    const blocked = evaluateInteractionRateLimit({
      nowMs: now,
      settings: {
        ...DEFAULT_RATE_LIMITS,
        interactionsPerDay: 1,
        interactionsPerHour: 100,
        cooldownSec: 0,
        duplicateReactionCooldownSec: 0,
      },
      reactionKey: 'hi2',
      existing: {
        ...baseExisting,
        interactionDayKey: first.nextBucket.interactionDayKey,
        interactionDayCount: 1,
        interactionHourKey: first.nextBucket.interactionHourKey,
        interactionHourCount: 0,
        interactionMinuteKey: first.nextBucket.interactionMinuteKey,
        interactionMinuteCount: 0,
      },
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/Daily/i);
  });

  it('rate-limits OTP requests per hour', () => {
    const now = Date.now();
    const denied = evaluateOtpRateLimit({
      nowMs: now,
      otpPerHour: 2,
      existing: { otpHourKey: 'x', otpHourCount: 2 },
    });
    // When hour key mismatches, count resets - force same key via allowed path then deny
    const first = evaluateOtpRateLimit({
      nowMs: now,
      otpPerHour: 1,
      existing: {},
    });
    expect(first.allowed).toBe(true);
    const second = evaluateOtpRateLimit({
      nowMs: now,
      otpPerHour: 1,
      existing: first.next,
    });
    expect(second.allowed).toBe(false);
    void denied;
  });
});

describe('notification grouping', () => {
  const windowMs = 120_000;
  const now = 1_000_000;

  it('individual always sends immediate', () => {
    expect(
      decideNotificationSend({
        mode: 'individual',
        nowMs: now,
        windowMs,
        existing: { count: 5, windowStartedAt: now - 1000 },
      }),
    ).toEqual({ action: 'send_immediate', count: 1 });
  });

  it('smart sends first immediately then groups', () => {
    expect(
      decideNotificationSend({
        mode: 'smart',
        nowMs: now,
        windowMs,
        existing: null,
      }),
    ).toEqual({ action: 'send_immediate', count: 1 });

    expect(
      decideNotificationSend({
        mode: 'smart',
        nowMs: now + 10_000,
        windowMs,
        existing: { count: 1, windowStartedAt: now },
      }),
    ).toEqual({ action: 'send_grouped', count: 2 });
  });

  it('grouped accumulates counts', () => {
    expect(
      decideNotificationSend({
        mode: 'grouped',
        nowMs: now + 5_000,
        windowMs,
        existing: { count: 4, windowStartedAt: now },
      }),
    ).toEqual({ action: 'send_grouped', count: 5 });
  });

  it('formats grouped bodies', () => {
    expect(formatGroupedBody('Saurav misses you', 5)).toContain('×5');
    expect(
      formatGroupedBody('Saurav missed you', 5, '2 minutes'),
    ).toMatch(/5 times in the last 2 minutes/);
  });

  it('resolves grouping window from seconds', () => {
    expect(resolveGroupingWindowMs({ groupingWindowSeconds: 30 })).toBe(30_000);
    expect(resolveGroupingWindowMs({ batchWindowMinutes: 2 })).toBe(120_000);
    expect(windowSecondsToLabel(30)).toBe('30 seconds');
    expect(windowSecondsToLabel(120)).toBe('2 minutes');
  });
});
