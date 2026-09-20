import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import type { AdminSettings, NotificationSettings, RateLimitSettings } from '../types';
import { DEFAULT_RATE_LIMITS } from './rateLimits';
import { defaultEnabledReactions } from './reactions';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  mode: 'smart',
  groupingWindowSeconds: 120,
  batchWindowMinutes: 2,
  quietHoursEnabled: false,
  defaultQuietHoursStart: '22:00',
  defaultQuietHoursEnd: '07:00',
};

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  id: 'global',
  maintenanceMode: false,
  allowNewSignups: true,
  minAppVersion: '1.0.0',
  rateLimits: DEFAULT_RATE_LIMITS,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  enabledReactions: defaultEnabledReactions(),
  featureFlags: {
    contactDiscovery: true,
    customReactions: true,
    milestones: true,
  },
  updatedAt: 0,
};

export function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

export function requireAuth(uid: string | undefined): string {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  return uid;
}

type FirestoreData = Record<string, unknown>;

function asPartialRateLimits(
  value: unknown,
): Partial<RateLimitSettings> | undefined {
  if (value == null || typeof value !== 'object') {
    return undefined;
  }
  return value as Partial<RateLimitSettings>;
}

function asPartialNotifications(
  value: unknown,
): Partial<NotificationSettings> | undefined {
  if (value == null || typeof value !== 'object') {
    return undefined;
  }
  return value as Partial<NotificationSettings>;
}

function asPartialFlags(
  value: unknown,
): Partial<AdminSettings['featureFlags']> | undefined {
  if (value == null || typeof value !== 'object') {
    return undefined;
  }
  return value as Partial<AdminSettings['featureFlags']>;
}

function asBoolMap(value: unknown): Record<string, boolean> | undefined {
  if (value == null || typeof value !== 'object') {
    return undefined;
  }
  return value as Record<string, boolean>;
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (
    value != null &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export async function loadAdminSettings(
  db: admin.firestore.Firestore,
): Promise<AdminSettings> {
  const snap = await db.collection('adminSettings').doc('global').get();
  if (!snap.exists) {
    return {
      ...DEFAULT_ADMIN_SETTINGS,
      rateLimits: { ...DEFAULT_RATE_LIMITS },
      notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
      enabledReactions: defaultEnabledReactions(),
    };
  }
  return mergeAdminSettings(snap.data() as FirestoreData);
}

export function mergeAdminSettings(data: FirestoreData): AdminSettings {
  return {
    ...DEFAULT_ADMIN_SETTINGS,
    ...data,
    id: 'global',
    rateLimits: {
      ...DEFAULT_RATE_LIMITS,
      ...asPartialRateLimits(data.rateLimits),
    },
    notifications: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...asPartialNotifications(data.notifications),
    },
    featureFlags: {
      ...DEFAULT_ADMIN_SETTINGS.featureFlags,
      ...asPartialFlags(data.featureFlags),
    },
    enabledReactions: {
      ...defaultEnabledReactions(),
      ...asBoolMap(data.enabledReactions),
    },
    updatedAt: toMillis(data.updatedAt),
    updatedBy:
      data.updatedBy != null ? String(data.updatedBy) : undefined,
    adminUid: data.adminUid != null ? String(data.adminUid) : undefined,
  };
}

export async function assertAdmin(
  db: admin.firestore.Firestore,
  uid: string,
  token?: { admin?: boolean },
): Promise<void> {
  if (token?.admin === true) {
    return;
  }

  const settings = await loadAdminSettings(db);
  if (settings.adminUid && settings.adminUid === uid) {
    return;
  }

  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists && userSnap.data()?.isAdmin === true) {
    return;
  }

  throw new HttpsError('permission-denied', 'Admin access required.');
}

export function isEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true';
}

export function allowTestOtp(): boolean {
  return (
    isEmulator() ||
    process.env.ALLOW_TEST_OTP === 'true' ||
    process.env.ALLOW_TEST_OTP === '1'
  );
}
