import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { getReactionDefinition, getShortReactionLabel } from '@/constants/reactions';
import {
  getSentFeelingBreakdown,
  getSentFeelingMessages,
  type FeelingBreakdown,
  type SentFeelingMessage,
  type SentFeelingRange,
} from '@/services/interactionService';
import { useSentCountsStore } from '@/stores/sentCountsStore';
import { Colors, Radii, Shadows, Spacing, Typography } from '@/theme/colors';
import { formatActivityTime } from '@/utils/dates';

export type SentPeriod =
  'today' | 'yesterday' | 'week' | 'month' | 'sixMonths' | 'custom';

const PERIODS: Array<{ id: SentPeriod; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: '1 month' },
  { id: 'sixMonths', label: '6 months' },
  { id: 'custom', label: 'Custom' },
];

function rangeForPeriod(
  period: SentPeriod,
  customStart?: string,
  customEnd?: string,
): SentFeelingRange | undefined {
  const now = new Date();
  if (period === 'today') {
    return {
      startAt: startOfDay(now).getTime(),
      endAt: endOfDay(now).getTime() + 1,
    };
  }
  if (period === 'yesterday') {
    const y = subDays(now, 1);
    return {
      startAt: startOfDay(y).getTime(),
      endAt: endOfDay(y).getTime() + 1,
    };
  }
  if (period === 'week') {
    return {
      startAt: startOfWeek(now, { weekStartsOn: 1 }).getTime(),
      endAt: endOfDay(now).getTime() + 1,
    };
  }
  if (period === 'month') {
    return {
      startAt: startOfDay(subDays(now, 30)).getTime(),
      endAt: endOfDay(now).getTime() + 1,
    };
  }
  if (period === 'sixMonths') {
    return {
      startAt: startOfDay(subMonths(now, 6)).getTime(),
      endAt: endOfDay(now).getTime() + 1,
    };
  }
  // custom
  if (!customStart?.trim() || !customEnd?.trim()) return undefined;
  try {
    const start = startOfDay(parseISO(customStart.trim()));
    const end = endOfDay(parseISO(customEnd.trim()));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return undefined;
    }
    return { startAt: start.getTime(), endAt: end.getTime() + 1 };
  } catch {
    return undefined;
  }
}

type Props = {
  connectionIds: string[];
  userId?: string;
  /** Bump to force a refetch (e.g. after send). */
  refreshKey?: number;
};

/**
 * Per-emoji sent counts with Today / Yesterday / This week / 1 month / 6 months / Custom.
 */
export function SentFeelingsSummary({ connectionIds, userId, refreshKey = 0 }: Props) {
  const [period, setPeriod] = useState<SentPeriod>('today');
  const [customStart, setCustomStart] = useState(
    format(subDays(new Date(), 7), 'yyyy-MM-dd'),
  );
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customOpen, setCustomOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<{
    key: string;
    emoji: string;
    label: string;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMessages, setDetailMessages] = useState<SentFeelingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FeelingBreakdown>({
    total: 0,
    byReaction: {},
    labels: {},
  });

  const localBy = useSentCountsStore((s) => s.byReaction);
  const localTotal = useSentCountsStore((s) => s.total);

  const range = useMemo(
    () => rangeForPeriod(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  const load = useCallback(async () => {
    if (!userId || connectionIds.length === 0) {
      setData({ total: 0, byReaction: {}, labels: {} });
      return;
    }
    if (period === 'custom' && !range) {
      return;
    }
    setLoading(true);
    try {
      const breakdown = await getSentFeelingBreakdown(connectionIds, userId, range);
      // For "today", blend with local optimistic counts if remote is behind.
      if (period === 'today' && localTotal > breakdown.total) {
        const merged = { ...breakdown.byReaction };
        for (const [k, v] of Object.entries(localBy)) {
          merged[k] = Math.max(merged[k] ?? 0, v);
        }
        const total = Object.values(merged).reduce((a, b) => a + b, 0);
        setData({
          byReaction: merged,
          total: Math.max(total, localTotal),
          labels: breakdown.labels,
        });
      } else {
        setData(breakdown);
      }
    } catch {
      if (period === 'today') {
        setData({ byReaction: localBy, total: localTotal, labels: {} });
      } else {
        setData({ total: 0, byReaction: {}, labels: {} });
      }
    } finally {
      setLoading(false);
    }
  }, [userId, connectionIds, period, range, localBy, localTotal]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Collapse list when the period changes.
  useEffect(() => {
    setExpanded(false);
  }, [period, customStart, customEnd]);

  const rows = Object.entries(data.byReaction)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const custom = data.labels[key];
      if (custom) {
        return {
          key,
          emoji: custom.emoji || '💕',
          label: custom.title || 'Custom feeling',
          count,
        };
      }
      const def = getReactionDefinition(
        (Number.isNaN(Number(key)) ? key : Number(key)) as never,
      );
      const title =
        def && !def.isMeta
          ? def.title
          : key.startsWith('custom')
            ? 'Custom feeling'
            : getShortReactionLabel(key);
      return {
        key,
        emoji: def && !def.isMeta ? def.emoji : '💕',
        label: title,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const TOP_N = 5;
  const visibleRows = expanded ? rows : rows.slice(0, TOP_N);
  const hiddenCount = Math.max(0, rows.length - TOP_N);

  const openDetail = async (row: { key: string; emoji: string; label: string }) => {
    if (!userId) return;
    setDetail(row);
    setDetailLoading(true);
    setDetailMessages([]);
    try {
      const messages = await getSentFeelingMessages(
        connectionIds,
        userId,
        row.key,
        range,
      );
      setDetailMessages(messages);
    } catch {
      setDetailMessages([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const onSelectPeriod = (id: SentPeriod) => {
    if (id === 'custom') {
      setCustomOpen(true);
      setPeriod('custom');
      return;
    }
    setPeriod(id);
  };

  const applyCustom = () => {
    setCustomOpen(false);
    setPeriod('custom');
  };

  const periodTitle =
    period === 'custom' && customStart && customEnd
      ? `${customStart} to ${customEnd}`
      : (PERIODS.find((p) => p.id === period)?.label ?? 'Today');

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {PERIODS.map((p) => {
          const active = period === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelectPeriod(p.id)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={p.label}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <LinearGradient
        colors={['#FFF8F2', '#FFE4EC', '#FFF0F5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, Shadows.soft]}
      >
        <Text style={styles.periodTitle}>{periodTitle}</Text>

        {loading ? (
          <ActivityIndicator color={Colors.rose} style={{ marginVertical: 16 }} />
        ) : rows.length === 0 ? (
          <Text style={styles.emptyText}>No feelings sent in this period yet.</Text>
        ) : (
          <>
            {visibleRows.map((row) => (
              <Pressable
                key={row.key}
                onPress={() => void openDetail(row)}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`${row.label}, ${row.count} sent. Tap to see all messages.`}
              >
                <Text style={styles.emoji}>{row.emoji}</Text>
                <View style={styles.labelWrap}>
                  <Text style={styles.label} numberOfLines={2}>
                    {row.label}
                  </Text>
                  <Text style={styles.rowHint}>Tap to see all messages</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.count}>× {row.count}</Text>
                </View>
              </Pressable>
            ))}

            {hiddenCount > 0 ? (
              <Pressable
                onPress={() => setExpanded((v) => !v)}
                style={styles.showMoreBtn}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Show less' : `Show ${hiddenCount} more`}
              >
                <Text style={styles.showMoreText}>
                  {expanded ? 'Show less' : `Show more (${hiddenCount})`}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total sent</Text>
              <Text style={styles.totalValue}>{data.total}</Text>
            </View>
          </>
        )}
      </LinearGradient>

      <Modal
        visible={customOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomOpen(false)}
      >
        <Pressable style={styles.modalBgCenter} onPress={() => setCustomOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Custom dates</Text>
            <Text style={styles.modalHint}>Use YYYY-MM-DD</Text>
            <Text style={styles.fieldLabel}>From</Text>
            <TextInput
              value={customStart}
              onChangeText={setCustomStart}
              placeholder="2026-01-01"
              placeholderTextColor={Colors.inkSubtle}
              autoCapitalize="none"
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>To</Text>
            <TextInput
              value={customEnd}
              onChangeText={setCustomEnd}
              placeholder={format(new Date(), 'yyyy-MM-dd')}
              placeholderTextColor={Colors.inkSubtle}
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCustomOpen(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={applyCustom} style={styles.modalApply}>
                <Text style={styles.modalApplyText}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={detail != null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetail(null)}
      >
        <Pressable style={styles.modalBg} onPress={() => setDetail(null)}>
          <Pressable style={styles.detailCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailEmoji}>{detail?.emoji}</Text>
              <View style={styles.detailTitleWrap}>
                <Text style={styles.modalTitle}>{detail?.label}</Text>
                <Text style={styles.modalHint}>
                  Every message you sent · {periodTitle}
                </Text>
              </View>
              <Pressable
                onPress={() => setDetail(null)}
                hitSlop={10}
                style={styles.detailClose}
              >
                <Text style={styles.detailCloseText}>✕</Text>
              </Pressable>
            </View>

            {detailLoading ? (
              <ActivityIndicator color={Colors.rose} style={{ marginVertical: 24 }} />
            ) : detailMessages.length === 0 ? (
              <Text style={styles.emptyText}>No messages found.</Text>
            ) : (
              <ScrollView
                style={styles.detailList}
                contentContainerStyle={styles.detailListPad}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {detailMessages.map((m) => (
                  <View key={m.id} style={styles.detailRow}>
                    <Text style={styles.detailMsg}>
                      {m.emoji} {m.message || m.title}
                    </Text>
                    <Text style={styles.detailTime}>
                      {formatActivityTime(m.createdAt)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginBottom: Spacing.sm },
  chips: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.rose,
    borderColor: Colors.rose,
  },
  chipText: {
    ...Typography.caption,
    color: Colors.inkMuted,
    fontWeight: '700',
  },
  chipTextActive: {
    color: Colors.white,
  },
  card: {
    borderRadius: Radii['2xl'],
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(232, 90, 122, 0.2)',
    gap: Spacing.sm,
  },
  periodTitle: {
    ...Typography.overline,
    color: Colors.rose,
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  emoji: {
    fontSize: 26,
    width: 34,
    textAlign: 'center',
  },
  labelWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: Spacing.sm,
  },
  label: {
    ...Typography.bodyStrong,
    color: Colors.ink,
    fontSize: 15,
    lineHeight: 20,
  },
  rowHint: {
    ...Typography.caption,
    color: Colors.inkSubtle,
    marginTop: 2,
    fontSize: 11,
  },
  countBadge: {
    flexShrink: 0,
    backgroundColor: Colors.blush,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  count: {
    ...Typography.label,
    color: Colors.roseDark,
    fontWeight: '800',
    fontSize: 13,
  },
  showMoreBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  showMoreText: {
    ...Typography.label,
    color: Colors.roseDark,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.roseLight,
    marginVertical: Spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  totalLabel: {
    ...Typography.label,
    color: Colors.ink,
    fontWeight: '700',
  },
  totalValue: {
    ...Typography.heading,
    color: Colors.rose,
    fontSize: 28,
  },
  emptyText: {
    ...Typography.caption,
    color: Colors.inkMuted,
    fontStyle: 'italic',
    paddingVertical: Spacing.md,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(40,20,30,0.45)',
    justifyContent: 'flex-end',
  },
  modalBgCenter: {
    flex: 1,
    backgroundColor: 'rgba(40,20,30,0.45)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii['2xl'],
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  modalTitle: {
    ...Typography.heading,
    color: Colors.ink,
  },
  modalHint: {
    ...Typography.caption,
    color: Colors.inkMuted,
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.inkMuted,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.roseLight,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    color: Colors.ink,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalCancel: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  modalCancelText: {
    ...Typography.label,
    color: Colors.inkMuted,
  },
  modalApply: {
    backgroundColor: Colors.rose,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  modalApplyText: {
    ...Typography.label,
    color: Colors.white,
    fontWeight: '700',
  },
  detailCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii['2xl'],
    borderTopRightRadius: Radii['2xl'],
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['2xl'],
    height: '90%',
    maxHeight: '90%',
    marginTop: 'auto',
    gap: Spacing.md,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  detailEmoji: { fontSize: 36 },
  detailTitleWrap: { flex: 1, gap: 2 },
  detailClose: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCloseText: {
    ...Typography.label,
    color: Colors.roseDark,
    fontSize: 16,
  },
  detailList: { flex: 1, minHeight: 0 },
  detailListPad: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  detailRow: {
    backgroundColor: Colors.cream,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.roseLight,
    padding: Spacing.md,
    gap: 4,
  },
  detailMsg: {
    ...Typography.body,
    color: Colors.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  detailTime: {
    ...Typography.caption,
    color: Colors.inkSubtle,
  },
});
