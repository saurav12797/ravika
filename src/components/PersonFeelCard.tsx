import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/ui';
import {
  buildOneTapFeelings,
  getShortReactionLabel,
  SENDABLE_REACTIONS,
  type OneTapFeeling,
} from '@/constants/reactions';
import { getRelationshipDefinition } from '@/constants/relationships';
import { sendReaction, getSentFeelingBreakdown } from '@/services/interactionService';
import { derivePresenceStatus } from '@/services/presenceService';
import { useAuthStore } from '@/stores/authStore';
import {
  EMPTY_FEELING_USAGE,
  useConnectionFeelingUsageStore,
} from '@/stores/connectionFeelingUsageStore';
import { useSentCountsStore } from '@/stores/sentCountsStore';
import { useUiStore } from '@/stores/uiStore';
import { useConnections } from '@/hooks/useConnections';
import { pickFeelingMessage } from '@/utils/feelingMessages';
import { Colors, Radii, Shadows, Spacing, Typography } from '@/theme/colors';
import type { Connection, ReactionType, UserProfile } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

/** Hold chips locked while send runs + celebration plays (~3.8s). */
const SEND_LOCK_MS = 4200;

const GRID_COUNT = 18;

type Props = {
  connection: Connection;
  peer: UserProfile | null;
  onOpenProfile?: () => void;
  onMoreFeelings?: () => void;
  onCustomFeeling?: () => void;
  onTogglePin?: () => void;
  pinned?: boolean;
  pinBusy?: boolean;
  onSent?: (reactionType: ReactionType) => void;
  /** Bump on pull-to-refresh to re-rank Tap to send. */
  orderResetKey?: number;
};

function FeelChip({
  emoji,
  label,
  busy,
  disabled,
  onPress,
}: {
  emoji: string;
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Send ${label}`}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withTiming(0.92, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
      }}
      onPress={onPress}
      style={styles.chipPress}
    >
      <Animated.View style={[styles.chip, busy && styles.chipBusy, style]}>
        {busy ? (
          <ActivityIndicator color={Colors.rose} size="small" />
        ) : (
          <>
            <Text style={styles.chipEmoji}>{emoji}</Text>
            <Text style={styles.chipLabel} numberOfLines={2}>
              {label}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Tall send card: Tap to send grid. Order is frozen for this visit so
 * sending doesn't reshuffle chips — resets on tab focus / refresh / remount.
 */
export function PersonFeelCard({
  connection,
  peer,
  onOpenProfile,
  onMoreFeelings,
  onCustomFeeling,
  onTogglePin,
  pinned,
  pinBusy,
  onSent,
  orderResetKey = 0,
}: Props) {
  const userId = useAuthStore((s) => s.user?.uid);
  const peerId = connection.userIds.find((id) => id !== userId) ?? '';
  const participant = userId ? connection.participants[userId] : undefined;
  const relationship = participant
    ? getRelationshipDefinition(participant.relationshipType)
    : undefined;
  const name =
    participant?.nickname || peer?.displayName || peer?.username || 'Someone';
  const firstName = name.split(' ')[0] || name;
  const presence = derivePresenceStatus(peer?.lastActiveAt);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [orderVisit, setOrderVisit] = useState(0);
  const frozenKeysRef = useRef<string[] | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentCelebration = useUiStore((s) => s.sentCelebration);
  const sendLocked = busyId != null || cooldown || sentCelebration != null;
  const { withPeers } = useConnections();
  const hydrateUsage = useConnectionFeelingUsageStore((s) => s.hydrate);
  const hydrateSent = useSentCountsStore((s) => s.hydrate);
  const mergeRemoteSent = useSentCountsStore((s) => s.mergeRemote);
  const overallFrequency = useSentCountsStore((s) => s.byReaction);
  const selectUsage = useCallback(
    (s: { byConnection: Record<string, { items: typeof EMPTY_FEELING_USAGE }> }) =>
      s.byConnection[connection.id]?.items ?? EMPTY_FEELING_USAGE,
    [connection.id],
  );
  const usageItems = useConnectionFeelingUsageStore(selectUsage);
  const allConnectionIds = useMemo(
    () => withPeers.map((p) => p.connection.id),
    [withPeers],
  );

  // Re-rank only when entering this tab / remounting — not after each send.
  useFocusEffect(
    useCallback(() => {
      frozenKeysRef.current = null;
      setOrderVisit((v) => v + 1);
    }, []),
  );

  useEffect(() => {
    frozenKeysRef.current = null;
    setOrderVisit((v) => v + 1);
  }, [connection.id, orderResetKey]);

  useEffect(() => {
    void hydrateUsage(connection.id, { force: true });
    void hydrateSent();
  }, [hydrateUsage, hydrateSent, connection.id]);

  useEffect(() => {
    if (!userId || allConnectionIds.length === 0) return;
    let cancelled = false;
    void getSentFeelingBreakdown(allConnectionIds, userId).then((b) => {
      if (cancelled || b.total <= 0) return;
      mergeRemoteSent(b.byReaction, b.total);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, allConnectionIds, mergeRemoteSent]);

  const liveFeelings = useMemo(
    () =>
      buildOneTapFeelings({
        includeShared: false,
        usage: usageItems,
        frequency: overallFrequency,
        overrides: connection.feelingOverrides,
        limit: GRID_COUNT,
      }),
    [usageItems, overallFrequency, connection.feelingOverrides],
  );

  /** Full pack for search (home Tap to send). */
  const allFeelings = useMemo(
    () =>
      buildOneTapFeelings({
        includeShared: false,
        usage: usageItems,
        frequency: overallFrequency,
        overrides: connection.feelingOverrides,
        limit: SENDABLE_REACTIONS.length,
      }),
    [usageItems, overallFrequency, connection.feelingOverrides],
  );

  const feelings = useMemo(() => {
    if (!frozenKeysRef.current) {
      frozenKeysRef.current = liveFeelings.map((f) => f.usageKey);
      return liveFeelings;
    }
    const byKey = new Map(liveFeelings.map((f) => [f.usageKey, f]));
    const ordered: OneTapFeeling[] = [];
    for (const key of frozenKeysRef.current) {
      const item = byKey.get(key);
      if (item) ordered.push(item);
    }
    for (const item of liveFeelings) {
      if (!frozenKeysRef.current.includes(item.usageKey)) {
        ordered.push(item);
      }
    }
    return ordered.slice(0, GRID_COUNT);
    // orderVisit forces a fresh snapshot after tab focus / connection change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFeelings, orderVisit]);

  const visibleFeelings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return feelings;
    return allFeelings.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.defaultMessage.toLowerCase().includes(q) ||
        r.emoji.includes(q) ||
        getShortReactionLabel(r.id).toLowerCase().includes(q),
    );
  }, [search, feelings, allFeelings]);

  const send = async (feeling: OneTapFeeling) => {
    if (!peerId || sendLocked) return;
    const key = feeling.usageKey;
    setBusyId(key);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    try {
      await sendReaction({
        connectionId: connection.id,
        toUserId: peerId,
        reactionType: feeling.id,
        customReactionId: feeling.customFeelingId,
        emoji: feeling.emoji,
        title: feeling.title,
        message: feeling.customFeelingId
          ? feeling.defaultMessage
          : pickFeelingMessage(feeling),
        toDisplayName: name,
      });
      onSent?.(feeling.id);
      setBusyId(null);
      setCooldown(true);
      // Keep locked through celebration so double-taps cannot fire.
      lockTimerRef.current = setTimeout(() => {
        setCooldown(false);
        lockTimerRef.current = null;
      }, SEND_LOCK_MS);
    } catch (err) {
      setError(toUserMessage(err));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setBusyId(null);
      setCooldown(false);
    }
  };

  useEffect(() => {
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  return (
    <View style={[styles.card, Shadows.soft]}>
      <View style={styles.headerBand}>
        <Pressable
          onPress={onOpenProfile}
          style={styles.person}
          accessibilityRole="button"
          accessibilityLabel={`Open ${name}`}
        >
          <Avatar
            uri={peer?.avatarUrl}
            name={name}
            size={56}
            presence={presence}
          />
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>
              {firstName}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {relationship
                ? `${relationship.emoji} ${relationship.label}`
                : `@${peer?.username ?? '…'}`}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerRight}>
          {onTogglePin ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={pinned ? 'Unpin' : 'Pin'}
              disabled={pinBusy}
              hitSlop={10}
              onPress={onTogglePin}
              style={styles.iconBtn}
            >
              <Text style={styles.pinIcon}>{pinned ? '📌' : '📍'}</Text>
            </Pressable>
          ) : null}
          {onOpenProfile ? (
            <Pressable
              onPress={onOpenProfile}
              style={styles.openBtn}
              accessibilityRole="button"
              accessibilityLabel={`Open ${name} profile`}
            >
              <Text style={styles.openLink}>Open</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.split}>
        <Text style={styles.sectionLabel}>Tap to send</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search feelings…"
          placeholderTextColor={Colors.inkSubtle}
          style={styles.search}
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search reactions"
        />
        <View style={styles.feelGrid}>
          {visibleFeelings.map((r) => (
            <FeelChip
              key={r.usageKey}
              emoji={r.emoji}
              label={
                r.customFeelingId
                  ? r.title
                  : getShortReactionLabel(r.id)
              }
              busy={busyId === r.usageKey}
              disabled={sendLocked}
              onPress={() => void send(r)}
            />
          ))}
        </View>
        {search.trim() && visibleFeelings.length === 0 ? (
          <Text style={styles.emptySearch}>
            No feelings match “{search.trim()}”
          </Text>
        ) : null}
      </View>

      {(onCustomFeeling || onMoreFeelings) && (
        <View style={styles.footer}>
          {onCustomFeeling ? (
            <Pressable
              onPress={onCustomFeeling}
              style={[styles.writeBtn, sendLocked && styles.allBtnDisabled]}
              disabled={sendLocked}
              accessibilityRole="button"
              accessibilityLabel="Send Message"
            >
              <Text style={styles.writeText}>✍️ Send Message</Text>
            </Pressable>
          ) : null}
          {onMoreFeelings ? (
            <Pressable
              onPress={onMoreFeelings}
              style={[styles.allBtn, sendLocked && styles.allBtnDisabled]}
              disabled={sendLocked}
              accessibilityRole="button"
              accessibilityLabel="Show all feelings"
            >
              <Text style={styles.allText}>Show all</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  headerBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.blush,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 90, 122, 0.12)',
  },
  person: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minWidth: 0,
  },
  meta: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  name: {
    ...Typography.heading,
    color: Colors.ink,
    fontSize: 22,
  },
  sub: {
    ...Typography.caption,
    color: Colors.roseDark,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.full,
    backgroundColor: Colors.white,
  },
  pinIcon: { fontSize: 16 },
  openBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: Colors.white,
  },
  openLink: {
    ...Typography.label,
    color: Colors.rose,
    fontWeight: '700',
  },
  split: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  sectionLabel: {
    ...Typography.overline,
    color: Colors.rose,
    letterSpacing: 1,
  },
  search: {
    ...Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.white,
    color: Colors.ink,
  },
  emptySearch: {
    ...Typography.caption,
    color: Colors.inkMuted,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  feelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    rowGap: Spacing.md,
    columnGap: Spacing.md,
  },
  chipPress: {
    width: '30%',
    flexGrow: 1,
    maxWidth: '31.5%',
  },
  chip: {
    minHeight: 100,
    borderRadius: Radii.xl,
    backgroundColor: Colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  chipBusy: { opacity: 0.65 },
  chipEmoji: {
    fontSize: 30,
  },
  chipLabel: {
    ...Typography.caption,
    color: Colors.roseDark,
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  writeBtn: {
    flex: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    backgroundColor: Colors.blush,
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  writeText: {
    ...Typography.label,
    color: Colors.roseDark,
    fontWeight: '700',
  },
  allBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  allBtnDisabled: { opacity: 0.5 },
  allText: {
    ...Typography.label,
    color: Colors.inkMuted,
    fontWeight: '600',
  },
  error: {
    ...Typography.caption,
    color: Colors.danger,
    textAlign: 'center',
    paddingBottom: Spacing.md,
  },
});
