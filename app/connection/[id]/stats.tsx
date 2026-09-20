import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { ConnectionSubnav } from '@/components/ConnectionSubnav';
import { StatChip } from '@/components/StatChip';
import { SimpleBarChart } from '@/components/SimpleBarChart';
import { useConnectionDetail } from '@/hooks/useConnectionDetail';
import { getConnectionStats } from '@/services/statsService';
import { getConnectionFeelingBreakdown } from '@/services/interactionService';
import {
  getReactionDefinition,
  getShortReactionLabel,
} from '@/constants/reactions';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import { format, parseISO } from 'date-fns';

export default function ConnectionStatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { peer, loading: detailLoading, error: detailError, reload } =
    useConnectionDetail(id);

  const statsQuery = useQuery({
    queryKey: ['connection-stats', id],
    enabled: Boolean(id),
    queryFn: () => getConnectionStats(id!),
  });

  const liveFeelings = useQuery({
    queryKey: ['connection-feelings-live', id],
    enabled: Boolean(id),
    queryFn: () => getConnectionFeelingBreakdown(id!),
  });

  if (detailLoading || statsQuery.isLoading) return <LoadingState />;
  if (detailError || statsQuery.isError || !id) {
    return (
      <ErrorState
        error={detailError ?? statsQuery.error}
        onRetry={() => {
          reload();
          void statsQuery.refetch();
          void liveFeelings.refetch();
        }}
      />
    );
  }

  const stats = statsQuery.data;
  const liveBy = liveFeelings.data?.byReaction ?? {};
  const liveTotal = liveFeelings.data?.total ?? 0;

  const todayChips = Object.entries(
    Object.keys(stats?.today?.byReaction ?? {}).length
      ? (stats?.today?.byReaction ?? {})
      : liveBy,
  )
    .map(([key, value]) => {
      const custom = liveFeelings.data?.labels?.[key];
      if (custom && !Object.keys(stats?.today?.byReaction ?? {}).length) {
        return {
          key,
          emoji: custom.emoji || '💕',
          label: custom.title || 'Custom feeling',
          value: value ?? 0,
        };
      }
      const idNum = Number(key);
      const def = getReactionDefinition(
        (Number.isNaN(idNum) ? key : idNum) as never,
      );
      return {
        key,
        emoji: def && !def.isMeta ? def.emoji : custom?.emoji ?? '💕',
        label:
          def && !def.isMeta
            ? getShortReactionLabel(def.id)
            : custom?.title ?? 'Custom feeling',
        value: value ?? 0,
      };
    })
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!stats && liveTotal === 0) {
    return (
      <EmptyState
        emoji="📊"
        title="No stats yet"
        description={`Start sharing feelings with ${peer?.displayName ?? 'them'}.`}
      />
    );
  }

  const chart = (stats?.recentDaily ?? [])
    .slice()
    .reverse()
    .slice(-7)
    .map((d) => ({
      label: format(parseISO(d.dayKey), 'EEE'),
      value: d.totalCount,
    }));

  const reactionBars = Object.entries(
    Object.keys(stats?.week?.byReaction ?? {}).length
      ? (stats?.week?.byReaction ?? {})
      : liveBy,
  )
    .map(([key, value]) => {
      const custom = liveFeelings.data?.labels?.[key];
      const idNum = Number(key);
      const def = getReactionDefinition(
        (Number.isNaN(idNum) ? key : idNum) as never,
      );
      return {
        label:
          def && !def.isMeta
            ? def.emoji
            : custom?.emoji ?? '💫',
        value: value ?? 0,
      };
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const todayTotal = stats?.today?.totalCount || liveTotal;
  const weekTotal = stats?.week?.totalCount ?? 0;
  const monthTotal = stats?.month?.totalCount ?? 0;
  const streak = stats?.week?.streakDays ?? 0;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['3xl'] }}
    >
      <ConnectionSubnav connectionId={id} />
      <View style={styles.pad}>
        <Text style={styles.title}>
          Stats with {peer?.displayName?.split(' ')[0] ?? 'them'}
        </Text>

        {todayChips.length > 0 ? (
          <>
            <Text style={styles.section}>Feelings you’ve shared</Text>
            <View style={styles.rowWrap}>
              {todayChips.map((chip) => (
                <StatChip
                  key={chip.key}
                  emoji={chip.emoji}
                  label={chip.label}
                  value={chip.value}
                />
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.row}>
          {todayTotal > 0 ? (
            <StatChip emoji="☀️" label="Today" value={todayTotal} />
          ) : null}
          {weekTotal > 0 ? (
            <StatChip emoji="📅" label="Week" value={weekTotal} />
          ) : null}
        </View>
        <View style={styles.row}>
          {monthTotal > 0 ? (
            <StatChip emoji="🌙" label="Month" value={monthTotal} />
          ) : null}
          {streak > 0 ? (
            <StatChip emoji="🔥" label="Streak" value={`${streak}d`} />
          ) : null}
        </View>

        {chart.some((c) => c.value > 0) ? (
          <>
            <Text style={styles.section}>Recent days</Text>
            <View style={styles.card}>
              <SimpleBarChart data={chart} color={Colors.coral} />
            </View>
          </>
        ) : null}

        {reactionBars.length > 0 ? (
          <>
            <Text style={styles.section}>By feeling</Text>
            <View style={styles.card}>
              <SimpleBarChart data={reactionBars} />
            </View>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  pad: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  title: {
    ...Typography.heading,
    color: Colors.ink,
    marginBottom: Spacing.sm,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  section: {
    ...Typography.heading,
    color: Colors.ink,
    marginTop: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
});
