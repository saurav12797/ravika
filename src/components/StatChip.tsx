import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';

export interface StatChipProps {
  label: string;
  value: string | number;
  emoji?: string;
  style?: StyleProp<ViewStyle>;
}

export function StatChip({ label, value, emoji, style }: StatChipProps) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.chip, style]}
    >
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    minWidth: 96,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  emoji: {
    fontSize: 18,
  },
  value: {
    ...Typography.heading,
    color: Colors.roseDark,
  },
  label: {
    ...Typography.caption,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
});
