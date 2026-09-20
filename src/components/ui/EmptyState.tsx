import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Spacing, Typography } from '@/theme/colors';
import { Button } from '@/components/ui/Button';

export interface EmptyStateProps {
  emoji?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  emoji = '💭',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View
      accessibilityRole="summary"
      style={[styles.container, style]}
    >
      <Text style={styles.emoji} accessibilityElementsHidden>
        {emoji}
      </Text>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing['5xl'],
    gap: Spacing.sm,
  },
  emoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.heading,
    color: Colors.ink,
    textAlign: 'center',
  },
  description: {
    ...Typography.body,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.lg,
    minWidth: 180,
  },
});
