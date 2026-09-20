import { onCall } from 'firebase-functions/v2/https';
import {
  assertAdmin,
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  getDb,
  isEmulator,
  requireAuth,
} from './helpers/admin';
import { DEFAULT_RATE_LIMITS } from './helpers/rateLimits';
import { defaultEnabledReactions } from './helpers/reactions';

interface SeedDefaultsResult {
  ok: true;
  adminSettings: typeof DEFAULT_ADMIN_SETTINGS;
}

/**
 * Seeds default adminSettings / rateLimitSettings / notificationSettings.
 * Allowed in emulator always; in production requires admin auth.
 */
export const seedDefaults = onCall(
  { cors: true },
  async (request): Promise<SeedDefaultsResult> => {
    const db = getDb();

    if (!isEmulator()) {
      const uid = requireAuth(request.auth?.uid);
      const token = request.auth?.token as { admin?: boolean } | undefined;
      await assertAdmin(db, uid, token);
    }

    const nowMs = Date.now();
    const adminSettings = {
      ...DEFAULT_ADMIN_SETTINGS,
      rateLimits: {
        ...DEFAULT_RATE_LIMITS,
        cooldownSec: 30,
        duplicateReactionCooldownSec: 30,
        interactionsPerHour: 50,
        interactionsPerDay: 200,
        interactionsPerMinute: 20,
        otpPerHour: 5,
        requestsPerDay: 30,
      },
      notifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        mode: 'smart' as const,
        groupingWindowSeconds: 120,
        batchWindowMinutes: 2,
      },
      enabledReactions: defaultEnabledReactions(),
      updatedAt: nowMs,
      updatedBy: request.auth?.uid ?? 'seedDefaults',
    };

    await db.collection('adminSettings').doc('global').set(adminSettings, {
      merge: true,
    });

    await db
      .collection('rateLimitSettings')
      .doc('global')
      .set(
        {
          ...adminSettings.rateLimits,
          updatedAt: nowMs,
        },
        { merge: true },
      );

    await db
      .collection('notificationSettings')
      .doc('global')
      .set(
        {
          ...adminSettings.notifications,
          updatedAt: nowMs,
        },
        { merge: true },
      );

    return { ok: true, adminSettings };
  },
);

/** Non-callable helper for scripts / tests. */
export async function seedDefaultsInternal(): Promise<void> {
  const db = getDb();
  const nowMs = Date.now();
  const adminSettings = {
    ...DEFAULT_ADMIN_SETTINGS,
    rateLimits: { ...DEFAULT_RATE_LIMITS },
    notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
    enabledReactions: defaultEnabledReactions(),
    updatedAt: nowMs,
    updatedBy: 'seedDefaultsInternal',
  };
  await db.collection('adminSettings').doc('global').set(adminSettings, {
    merge: true,
  });
}
