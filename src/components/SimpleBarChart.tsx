import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';

export interface BarDatum {
  label: string;
  value: number;
}

export interface SimpleBarChartProps {
  data: BarDatum[];
  maxBars?: number;
  color?: string;
}

/** Lightweight bar chart using View + flex - no chart library. */
export function SimpleBarChart({
  data,
  maxBars = 7,
  color = Colors.rose,
}: SimpleBarChartProps) {
  const bars = useMemo(() => data.slice(0, maxBars), [data, maxBars]);
  const max = Math.max(1, ...bars.map((b) => b.value));

  if (bars.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Bar chart of reaction counts"
      style={styles.wrap}
    >
      {bars.map((bar) => {
        const heightPct = Math.max(8, Math.round((bar.value / max) * 100));
        return (
          <View key={bar.label} style={styles.col}>
            <Text style={styles.value}>{bar.value}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  {
                    flex: heightPct,
                    backgroundColor: color,
                  },
                ]}
              />
              <View style={{ flex: Math.max(0, 100 - heightPct) }} />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {bar.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    height: 160,
    paddingTop: Spacing.md,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    gap: Spacing.xs,
  },
  track: {
    flex: 1,
    width: '100%',
    maxWidth: 36,
    backgroundColor: Colors.creamDark,
    borderRadius: Radii.sm,
    overflow: 'hidden',
    flexDirection: 'column-reverse',
  },
  bar: {
    width: '100%',
    borderRadius: Radii.sm,
    minHeight: 4,
  },
  value: {
    ...Typography.overline,
    color: Colors.inkMuted,
  },
  label: {
    ...Typography.overline,
    color: Colors.inkSubtle,
    textAlign: 'center',
  },
  empty: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...Typography.caption,
    color: Colors.inkSubtle,
  },
});
