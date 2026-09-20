import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getCurrentUser } from '@/services/authService';
import { getDb, getFirebaseFunctions } from '@/services/firebase';
import { toMillis } from '@/services/firestoreUtils';
import { getUser } from '@/services/userService';
import type {
  AdminSettings,
  NotificationSettings,
  RateLimitSettings,
} from '@/types/models';
import { AppError } from '@/utils/errors';

const SETTINGS_DOC = 'adminSettings';
const SETTINGS_ID = 'global';

export const DEFAULT_RATE_LIMITS: RateLimitSettings = {
  otpPerHour: 5,
  interactionsPerMinute: 20,
  interactionsPerHour: 50,
  interactionsPerDay: 200,
  requestsPerDay: 30,
  cooldownSec: 30,
  duplicateReactionCooldownSec: 30,
};

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
  featureFlags: {
    contactDiscovery: true,
    customReactions: true,
    milestones: true,
  },
  updatedAt: 0,
};

function mapSettings(data: Record<string, unknown>): AdminSettings {
  return {
    ...DEFAULT_ADMIN_SETTINGS,
    ...data,
    id: 'global',
    rateLimits: {
      ...DEFAULT_RATE_LIMITS,
      ...(data.rateLimits as Partial<RateLimitSettings> | undefined),
    },
    notifications: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(data.notifications as Partial<NotificationSettings> | undefined),
    },
    featureFlags: {
      ...DEFAULT_ADMIN_SETTINGS.featureFlags,
      ...(data.featureFlags as Partial<AdminSettings['featureFlags']> | undefined),
    },
    updatedAt: toMillis(data.updatedAt as Parameters<typeof toMillis>[0]),
    updatedBy: data.updatedBy != null ? String(data.updatedBy) : undefined,
  };
}

export async function getAdminSettings(): Promise<AdminSettings> {
  const snap = await getDoc(doc(getDb(), SETTINGS_DOC, SETTINGS_ID));
  if (!snap.exists()) {
    return DEFAULT_ADMIN_SETTINGS;
  }
  return mapSettings(snap.data());
}

export async function updateAdminSettings(
  patch: Partial<Omit<AdminSettings, 'id'>>,
): Promise<AdminSettings> {
  const user = getCurrentUser();
  if (!user) {
    throw new AppError('auth/unauthenticated', 'Please sign in to continue.');
  }

  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    throw new AppError('permission-denied', 'Admin access required.');
  }

  const callable = httpsCallable<
    { patch: Partial<Omit<AdminSettings, 'id'>> },
    { settings: Record<string, unknown> }
  >(getFirebaseFunctions(), 'updateAdminSettings');

  const result = await callable({ patch });
  return mapSettings(result.data.settings);
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) {
    return false;
  }
  const profile = await getUser(user.uid);
  return Boolean(profile?.isAdmin);
}
