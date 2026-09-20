import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  assertAdmin,
  DEFAULT_ADMIN_SETTINGS,
  getDb,
  mergeAdminSettings,
  requireAuth,
} from '../helpers/admin';
import type { AdminSettings } from '../types';

interface UpdateAdminSettingsInput {
  patch: Partial<Omit<AdminSettings, 'id'>>;
}

interface UpdateAdminSettingsResult {
  settings: AdminSettings;
}

export const updateAdminSettings = onCall(
  { cors: true },
  async (request): Promise<UpdateAdminSettingsResult> => {
    const uid = requireAuth(request.auth?.uid);
    const db = getDb();
    const token = request.auth?.token as { admin?: boolean } | undefined;
    await assertAdmin(db, uid, token);

    const data = request.data as UpdateAdminSettingsInput;
    if (!data?.patch || typeof data.patch !== 'object') {
      throw new HttpsError('invalid-argument', 'patch is required.');
    }

    const patch = data.patch;
    const ref = db.collection('adminSettings').doc('global');
    const nowMs = Date.now();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists
        ? mergeAdminSettings(snap.data() as Record<string, unknown>)
        : { ...DEFAULT_ADMIN_SETTINGS };

      const next: AdminSettings = {
        ...current,
        ...patch,
        id: 'global',
        rateLimits: {
          ...current.rateLimits,
          ...(patch.rateLimits ?? {}),
        },
        notifications: {
          ...current.notifications,
          ...(patch.notifications ?? {}),
        },
        featureFlags: {
          ...current.featureFlags,
          ...(patch.featureFlags ?? {}),
        },
        enabledReactions: {
          ...(current.enabledReactions ?? {}),
          ...(patch.enabledReactions ?? {}),
        },
        updatedAt: nowMs,
        updatedBy: uid,
      };

      tx.set(ref, next, { merge: true });
    });

    const settings = mergeAdminSettings(
      (await ref.get()).data() as Record<string, unknown>,
    );

    await db
      .collection('rateLimitSettings')
      .doc('global')
      .set(
        {
          ...settings.rateLimits,
          updatedAt: nowMs,
          updatedBy: uid,
        },
        { merge: true },
      );

    await db
      .collection('notificationSettings')
      .doc('global')
      .set(
        {
          ...settings.notifications,
          updatedAt: nowMs,
          updatedBy: uid,
        },
        { merge: true },
      );

    return { settings };
  },
);
