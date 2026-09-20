import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Spacing, Typography } from '@/theme/colors';
import { Button } from '@/components/ui/Button';
import { toUserMessage } from '@/utils/errors';

export interface ErrorStateProps {
  error?: unknown;
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({
  error,
  title = 'Something went wrong',
  message,
  onRetry,
  style,
}: ErrorStateProps) {
  const body = message ?? (error != null ? toUserMessage(error) : 'Please try again.');

  return (
    <View
      accessibilityRole="alert"
      style={[styles.container, style]}
    >
      <Text style={styles.emoji}>💔</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{body}</Text>
      {onRetry ? (
        <Button title="Try again" onPress={onRetry} style={styles.action} />
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
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.heading,
    color: Colors.ink,
    textAlign: 'center',
  },
  message: {
    ...Typography.body,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.lg,
    minWidth: 160,
  },
});
