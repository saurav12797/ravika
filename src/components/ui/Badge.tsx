import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';

export type BadgeTone = 'rose' | 'coral' | 'neutral' | 'success' | 'warning';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}

const toneStyles: Record<
  BadgeTone,
  { backgroundColor: string; color: string }
> = {
  rose: { backgroundColor: Colors.blush, color: Colors.roseDark },
  coral: { backgroundColor: Colors.peach, color: Colors.coral },
  neutral: { backgroundColor: Colors.creamDark, color: Colors.inkMuted },
  success: { backgroundColor: Colors.successSoft, color: Colors.success },
  warning: { backgroundColor: Colors.warningSoft, color: Colors.warning },
};

export function Badge({ label, tone = 'rose', style }: BadgeProps) {
  const colors = toneStyles[tone];
  return (
    <View
      accessibilityRole="text"
      style={[
        styles.badge,
        { backgroundColor: colors.backgroundColor },
        style,
      ]}
    >
      <Text style={[styles.label, { color: colors.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.full,
  },
  label: {
    ...Typography.caption,
    fontWeight: '600',
  },
});
