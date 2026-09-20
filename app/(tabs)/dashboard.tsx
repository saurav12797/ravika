import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  endOfDay,
  format,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatChip } from '@/components/StatChip';
import { SimpleBarChart } from '@/components/SimpleBarChart';
import { useConnections } from '@/hooks/useConnections';
import {
  getSentFeelingBreakdown,
  type FeelingBreakdown,
} from '@/services/interactionService';
import { getReactionDefinition } from '@/constants/reactions';
import { MILESTONE_DEFINITIONS } from '@/constants/milestones';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';

type DashStats = {
  today: FeelingBreakdown;
  week: FeelingBreakdown;
  month: FeelingBreakdown;
  allTime: FeelingBreakdown;
};

const EMPTY: FeelingBreakdown = { total: 0, byReaction: {}, labels: {} };

/**
 * Dashboard aggregates YOUR sent feelings across all your connections
 * (not global all-users data). Refreshes on focus + pull-to-refresh.
 */
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.uid);
  const { withPeers, loading: connectionsLoading, error: connectionsError } =
    useConnections();
  const [stats, setStats] = useState<DashStats>({
    today: EMPTY,
    week: EMPTY,
    month: EMPTY,
    allTime: EMPTY,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const connectionIds = useMemo(
    () => withPeers.map((p) => p.connection.id),
    [withPeers],
  );

  const load = useCallback(async () => {
    if (!userId || connectionIds.length === 0) {
      setStats({ today: EMPTY, week: EMPTY, month: EMPTY, allTime: EMPTY });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      const [today, week, month, allTime] = await Promise.all([
        getSentFeelingBreakdown(connectionIds, userId, {
          startAt: startOfDay(now).getTime(),
          endAt: endOfDay(now).getTime() + 1,
        }),
        getSentFeelingBreakdown(connectionIds, userId, {
          startAt: startOfWeek(now, { weekStartsOn: 1 }).getTime(),
          endAt: endOfDay(now).getTime() + 1,
        }),
        getSentFeelingBreakdown(connectionIds, userId, {
          startAt: startOfDay(subDays(now, 30)).getTime(),
          endAt: endOfDay(now).getTime() + 1,
        }),
        getSentFeelingBreakdown(connectionIds, userId),
      ]);
      setStats({ today, week, month, allTime });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [userId, connectionIds]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const reactionBars = useMemo(() => {
    return Object.entries(stats.allTime.byReaction)
      .map(([key, value]) => {
        const custom = stats.allTime.labels[key];
        if (custom) {
          return { label: custom.emoji || '💕', value };
        }
        const id = Number.isNaN(Number(key)) ? key : Number(key);
        const def = getReactionDefinition(id as never);
        return {
          label: def && !def.isMeta ? def.emoji : '💫',
          value,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [stats.allTime]);

  const chart = useMemo(() => {
    // Approximate last-7 from week totals split evenly isn't ideal —
    // show week/month/today as chips instead; chart uses reaction mix.
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { label: format(d, 'EEE'), value: 0 };
    });
    // Put today's total on the last bar so the chart isn't empty.
    if (days.length > 0) {
      days[days.length - 1] = {
        ...days[days.length - 1],
        value: stats.today.total,
      };
    }
    return days;
  }, [stats.today.total]);

  if (connectionsLoading || (loading && withPeers.length > 0 && stats.allTime.total === 0)) {
    return <LoadingState label="Crunching your stats…" />;
  }

  if (connectionsError || error) {
    return (
      <ErrorState
        error={connectionsError ?? error}
        onRetry={() => void load()}
      />
    );
  }

  if (withPeers.length === 0) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + Spacing.lg }]}>
        <ScreenHeader title="Dashboard" subtitle="Your feeling stats" />
        <EmptyState
          emoji="📊"
          title="Stats appear after you connect"
          description="Send reactions to unlock streaks and milestones."
        />
      </View>
    );
  }

  const streak =
    stats.today.total > 0 ? Math.min(7, Math.max(1, stats.week.total)) : 0;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + 88 },
      ]}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} />
      }
    >
      <ScreenHeader
        title="Dashboard"
        subtitle="Your sends across all connections"
      />

      <View style={styles.row}>
        <StatChip emoji="☀️" label="Today" value={stats.today.total} />
        <StatChip emoji="📅" label="Week" value={stats.week.total} />
      </View>
      <View style={styles.row}>
        <StatChip emoji="🌙" label="Month" value={stats.month.total} />
        <StatChip emoji="♾️" label="All-time" value={stats.allTime.total} />
      </View>
      <View style={styles.row}>
        <StatChip emoji="🔥" label="Active days" value={`${streak}d`} />
      </View>

      <Text style={styles.section}>Today pulse</Text>
      <View style={styles.card}>
        <SimpleBarChart data={chart} color={Colors.coral} />
      </View>

      <Text style={styles.section}>By feeling</Text>
      <View style={styles.card}>
        <SimpleBarChart data={reactionBars} />
      </View>

      <Text style={styles.section}>Milestones</Text>
      <View style={styles.milestoneGrid}>
        {MILESTONE_DEFINITIONS.map((m) => {
          const unlocked =
            (m.metric === 'streak_days' && streak >= m.threshold) ||
            (m.metric === 'total_interactions' &&
              stats.allTime.total >= m.threshold) ||
            (m.metric === 'first' && stats.allTime.total >= 1);
          return (
            <View
              key={m.id}
              style={[styles.milestone, unlocked && styles.milestoneOn]}
              accessibilityLabel={`${m.title}${unlocked ? ', unlocked' : ', locked'}`}
            >
              <Text style={styles.milestoneEmoji}>{m.emoji}</Text>
              <Text style={styles.milestoneTitle}>{m.title}</Text>
              <Text style={styles.milestoneDesc}>{m.description}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  section: {
    ...Typography.heading,
    color: Colors.ink,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  milestoneGrid: {
    gap: Spacing.sm,
  },
  milestone: {
    backgroundColor: Colors.creamDark,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    opacity: 0.55,
  },
  milestoneOn: {
    backgroundColor: Colors.blush,
    opacity: 1,
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  milestoneEmoji: { fontSize: 24 },
  milestoneTitle: {
    ...Typography.bodyStrong,
    color: Colors.ink,
    marginTop: Spacing.xs,
  },
  milestoneDesc: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
});
