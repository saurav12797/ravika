/**
 * Ravika domain models.
 */

export type Gender =
  | 'female'
  | 'male'
  | 'non_binary'
  | 'prefer_not_to_say'
  | 'other';

export type NotificationMode = 'individual' | 'grouped' | 'smart';

export interface NotificationPreferences {
  pushEnabled: boolean;
  reactionNotifications: boolean;
  requestNotifications: boolean;
  milestoneNotifications: boolean;
  mode: NotificationMode;
  /** Quiet hours start as "HH:mm" local time. */
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface UserProfile {
  id: string;
  phoneE164: string;
  phoneHash: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  gender?: Gender;
  /** ISO date string YYYY-MM-DD */
  dateOfBirth?: string;
  notificationPreferences: NotificationPreferences;
  isAdmin: boolean;
  /** Epoch ms of last presence heartbeat. */
  lastActiveAt: number;
  createdAt: number;
  updatedAt: number;
  deviceTokens?: string[];
}

export type ConnectionStatus =
  | 'pending'
  | 'active'
  | 'declined'
  | 'blocked'
  | 'cancelled';

export type RelationshipType =
  | 'friend'
  | 'best_friend'
  | 'girlfriend'
  | 'boyfriend'
  | 'wife'
  | 'husband'
  | 'sister'
  | 'brother'
  | 'mother'
  | 'father'
  | 'daughter'
  | 'son'
  | 'cousin'
  | 'family'
  | 'crush'
  | 'soulmate'
  | 'other';

export interface ConnectionParticipant {
  relationshipType: RelationshipType;
  customLabel?: string;
  nickname?: string;
  pinned: boolean;
  /** Lower = higher priority among pins. */
  pinOrder?: number;
}

export interface Connection {
  id: string;
  /** Sorted pair of user ids for stable lookups. */
  userIds: [string, string];
  participants: Record<string, ConnectionParticipant>;
  status: ConnectionStatus;
  createdAt: number;
  updatedAt: number;
  acceptedAt?: number;
  lastInteractionAt?: number;
  interactionCount?: number;
  missYouCount?: number;
  /** Per-user unread feeling counts. */
  unreadCounts?: Record<string, number>;
  /** Custom emoji+name feelings shared by both people. */
  sharedFeelings?: SharedFeeling[];
  /**
   * Per-connection overrides for predefined feelings
   * (emoji / title / description), keyed by reaction id string.
   */
  feelingOverrides?: Record<string, FeelingOverride>;
}

/** Edit a catalog feeling's look/copy for this connection only. */
export interface FeelingOverride {
  emoji?: string;
  title?: string;
  /** Soft description / message under the title. */
  subtitle?: string;
}

/** One-tap custom feeling banner shared by both people. */
export interface SharedFeeling {
  id: string;
  emoji: string;
  /** Short heading on the banner. */
  title: string;
  /** Softer subheading under the title. */
  subtitle?: string;
  createdByUserId: string;
  createdAt: number;
}

export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'expired';

export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  proposedRelationshipType: RelationshipType;
  message?: string;
  status: RequestStatus;
  createdAt: number;
  updatedAt: number;
  respondedAt?: number;
}

/** Predefined reaction ids 1-100 plus custom variants. */
export type PredefinedReactionId =
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
  100;

export type ReactionType = PredefinedReactionId | 'custom_text' | 'custom';

export type ReactionCategory =
  | 'affection'
  | 'presence'
  | 'daily'
  | 'check_in'
  | 'playful'
  | 'custom';

export interface CustomReaction {
  id: string;
  ownerUserId: string;
  emoji: string;
  title: string;
  defaultMessage: string;
  animationId?: string;
  createdAt: number;
}

export interface Interaction {
  id: string;
  connectionId: string;
  fromUserId: string;
  toUserId: string;
  reactionType: ReactionType;
  /** Set when reactionType is custom / custom_text. */
  customReactionId?: string;
  emoji: string;
  title: string;
  message: string;
  animationId?: string;
  createdAt: number;
  dayKey: string;
}

/** WhatsApp-style delivery for 1:1 chat. */
export type ChatMessageStatus = 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  id: string;
  connectionId: string;
  fromUserId: string;
  text: string;
  createdAt: number;
  status: ChatMessageStatus;
  deliveredAt?: number;
  readAt?: number;
}

export interface ChatThread {
  connectionId: string;
  userIds: [string, string];
  lastMessage?: string;
  lastMessageAt?: number;
  lastFromUserId?: string;
  unreadCounts?: Record<string, number>;
  updatedAt: number;
}

export interface DailyStats {
  id: string;
  connectionId: string;
  dayKey: string;
  totalCount: number;
  byReaction: Partial<Record<string, number>>;
  bySender: Record<string, number>;
  updatedAt: number;
}

export interface WeeklyStats {
  id: string;
  connectionId: string;
  weekKey: string;
  totalCount: number;
  byReaction: Partial<Record<string, number>>;
  bySender: Record<string, number>;
  streakDays: number;
  updatedAt: number;
}

export interface MonthlyStats {
  id: string;
  connectionId: string;
  monthKey: string;
  totalCount: number;
  byReaction: Partial<Record<string, number>>;
  bySender: Record<string, number>;
  updatedAt: number;
}

export type MilestoneKind =
  | 'first_interaction'
  | 'miss_you_10'
  | 'interactions_100'
  | 'interactions_500'
  | 'interactions_1000'
  | 'streak_7';

export interface MilestoneDefinition {
  id: MilestoneKind;
  title: string;
  description: string;
  emoji: string;
  threshold: number;
  metric: 'total_interactions' | 'miss_you_count' | 'streak_days' | 'first';
}

export interface Milestone {
  id: string;
  connectionId: string;
  definitionId: MilestoneKind;
  achievedAt: number;
  celebratedAt?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface RateLimitSettings {
  /** Max OTP requests per phone per hour. */
  otpPerHour: number;
  /** Max interactions per user per minute. */
  interactionsPerMinute: number;
  /** Max interactions per user per hour. */
  interactionsPerHour: number;
  /** Max interactions per user per day. */
  interactionsPerDay: number;
  /** Max connection requests per user per day. */
  requestsPerDay: number;
  /** Minimum seconds between any two reactions (server-enforced). */
  cooldownSec: number;
  /** Extra cooldown when repeating the same reaction (seconds). */
  duplicateReactionCooldownSec: number;
}

export interface NotificationSettings {
  mode: NotificationMode;
  /**
   * Grouping window in seconds (30, 60, 120, 300, 600).
   * Prefer this over batchWindowMinutes when set.
   */
  groupingWindowSeconds: number;
  /** @deprecated Prefer groupingWindowSeconds. */
  batchWindowMinutes: number;
  quietHoursEnabled: boolean;
  defaultQuietHoursStart: string;
  defaultQuietHoursEnd: string;
  /** Optional per-reaction enable map (missing keys = enabled). */
  enabledReactions?: Record<string, boolean>;
}

export interface AdminSettings {
  id: 'global';
  maintenanceMode: boolean;
  allowNewSignups: boolean;
  minAppVersion: string;
  rateLimits: RateLimitSettings;
  notifications: NotificationSettings;
  featureFlags: {
    contactDiscovery: boolean;
    customReactions: boolean;
    milestones: boolean;
  };
  updatedAt: number;
  updatedBy?: string;
}

export type PresenceStatus = 'online' | 'recently' | 'offline';

export type RespondToRequestAction =
  | 'accept'
  | 'decline'
  | 'change_relationship';

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}
