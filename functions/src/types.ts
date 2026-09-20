/**
 * Shared types aligned with client `src/types/models.ts`.
 */

export type NotificationMode = 'individual' | 'grouped' | 'smart';

export type ReactionType =
  1 |
  2 |
  3 |
  4 |
  5 |
  6 |
  7 |
  8 |
  9 |
  10 |
  11 |
  12 |
  13 |
  14 |
  15 |
  16 |
  17 |
  18 |
  19 |
  20 |
  21 |
  22 |
  23 |
  24 |
  25 |
  26 |
  27 |
  28 |
  29 |
  30 |
  31 |
  32 |
  33 |
  34 |
  35 |
  36 |
  37 |
  38 |
  39 |
  40 |
  41 |
  42 |
  43 |
  44 |
  45 |
  46 |
  47 |
  48 |
  49 |
  50 |
  51 |
  52 |
  53 |
  54 |
  55 |
  56 |
  57 |
  58 |
  59 |
  60 |
  61 |
  62 |
  63 |
  64 |
  65 |
  66 |
  67 |
  68 |
  69 |
  70 |
  71 |
  72 |
  73 |
  74 |
  75 |
  76 |
  77 |
  78 |
  79 |
  80 |
  81 |
  82 |
  83 |
  84 |
  85 |
  86 |
  87 |
  88 |
  89 |
  90 |
  91 |
  92 |
  93 |
  94 |
  95 |
  96 |
  97 |
  98 |
  99 |
  100 |
  'custom_text'
  | 'custom'

export type ConnectionStatus =
  | 'pending'
  | 'active'
  | 'declined'
  | 'blocked'
  | 'cancelled';

export interface RateLimitSettings {
  otpPerHour: number;
  interactionsPerMinute: number;
  interactionsPerHour: number;
  interactionsPerDay: number;
  requestsPerDay: number;
  /** Minimum seconds between any two reactions. */
  cooldownSec: number;
  duplicateReactionCooldownSec: number;
}

export interface NotificationSettings {
  mode: NotificationMode;
  /** Preferred grouping window (30 / 60 / 120 / 300 / 600). */
  groupingWindowSeconds: number;
  /** @deprecated Prefer groupingWindowSeconds. */
  batchWindowMinutes: number;
  quietHoursEnabled: boolean;
  defaultQuietHoursStart: string;
  defaultQuietHoursEnd: string;
  enabledReactions?: Record<string, boolean>;
}

export interface AdminSettings {
  id: 'global';
  /** Optional dedicated admin uid (in addition to custom claim / isAdmin). */
  adminUid?: string;
  maintenanceMode: boolean;
  allowNewSignups: boolean;
  minAppVersion: string;
  rateLimits: RateLimitSettings;
  notifications: NotificationSettings;
  /** Optional map of reaction id → enabled. Missing keys default to true. */
  enabledReactions?: Record<string, boolean>;
  featureFlags: {
    contactDiscovery: boolean;
    customReactions: boolean;
    milestones: boolean;
  };
  updatedAt: number;
  updatedBy?: string;
}

export interface ConnectionParticipant {
  relationshipType: string;
  customLabel?: string;
  nickname?: string;
  pinned: boolean;
  pinOrder?: number;
}

export interface ConnectionDoc {
  userIds: [string, string];
  participants: Record<string, ConnectionParticipant>;
  status: ConnectionStatus;
  createdAt: TimestampLike | number;
  updatedAt: TimestampLike | number;
  acceptedAt?: TimestampLike | number;
  lastInteractionAt?: TimestampLike | number;
  interactionCount?: number;
  unreadCounts?: Record<string, number>;
}

export interface UserDoc {
  phoneE164?: string;
  phoneHash?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  isAdmin?: boolean;
  notificationPreferences?: {
    pushEnabled?: boolean;
    reactionNotifications?: boolean;
    requestNotifications?: boolean;
    milestoneNotifications?: boolean;
    mode?: NotificationMode;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  };
  deviceTokens?: string[];
  createdAt?: TimestampLike | number;
  updatedAt?: TimestampLike | number;
}

export interface OtpSessionDoc {
  phoneE164: string;
  phoneHash: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  consumed?: boolean;
}

export interface RateLimitBucketDoc {
  otpHourKey?: string;
  otpHourCount?: number;
  interactionMinuteKey?: string;
  interactionMinuteCount?: number;
  interactionHourKey?: string;
  interactionHourCount?: number;
  interactionDayKey?: string;
  interactionDayCount?: number;
  lastReactionAt?: number;
  lastReactionKey?: string;
  perReaction?: Record<string, { hourKey: string; count: number }>;
  updatedAt?: number;
}

export interface DeviceTokenDoc {
  token: string;
  platform?: string;
  updatedAt: number;
  createdAt: number;
}

export type MilestoneKind =
  | 'first_interaction'
  | 'miss_you_10'
  | 'interactions_100'
  | 'interactions_500'
  | 'interactions_1000'
  | 'streak_7';

/** Minimal Timestamp shape used in docs (avoids coupling to admin types). */
export interface TimestampLike {
  toMillis(): number;
}
