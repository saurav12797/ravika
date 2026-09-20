import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import { useUiStore } from '@/stores/uiStore';
import type { ReactionDefinition } from '@/constants/reactions';

export type ReactionSendState = 'idle' | 'pending' | 'sent' | 'failed';

export interface ReactionButtonProps {
  reaction: ReactionDefinition;
  onPress: (reaction: ReactionDefinition) => void | Promise<void>;
  /** Long-press to customize this feeling for the chat. */
  onLongPress?: (reaction: ReactionDefinition) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
  /** Compact short label under emoji. */
  label?: string;
}

/**
 * Soft rounded tile for predefined feelings (not a heavy bubble circle).
 */
export function ReactionButton({
  reaction,
  onPress,
  onLongPress,
  disabled,
  style,
  label,
}: ReactionButtonProps) {
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const scale = useSharedValue(1);
  const [state, setState] = useState<ReactionSendState>('idle');

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(async () => {
    if (disabled || state === 'pending') {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!reducedMotion) {
      scale.value = withSpring(0.96, { damping: 16 });
      scale.value = withSpring(1, { damping: 14 });
    }

    setState('pending');
    try {
      await onPress(reaction);
      setState('sent');
      setTimeout(() => setState('idle'), 700);
    } catch {
      setState('failed');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setState('idle'), 1200);
    }
  }, [disabled, onPress, reaction, reducedMotion, scale, state]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Send ${reaction.title}`}
      accessibilityState={{ disabled: Boolean(disabled) || state === 'pending' }}
      disabled={disabled || state === 'pending'}
      onPressIn={() => {
        if (!reducedMotion) scale.value = withTiming(0.97, { duration: 80 });
      }}
      onPressOut={() => {
        if (!reducedMotion) scale.value = withTiming(1, { duration: 120 });
      }}
      onPress={() => {
        void handlePress();
      }}
      onLongPress={
        onLongPress
          ? () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onLongPress(reaction);
            }
          : undefined
      }
      delayLongPress={350}
      style={[styles.press, style]}
    >
      <Animated.View
        style={[
          styles.tile,
          state === 'sent' && styles.sent,
          state === 'failed' && styles.failed,
          state === 'pending' && styles.pending,
          animatedStyle,
        ]}
      >
        <Text style={styles.emoji}>{reaction.emoji}</Text>
        <Text numberOfLines={2} style={styles.title}>
          {label ?? reaction.title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
    minWidth: '29%',
    maxWidth: '32%',
    marginHorizontal: 2,
  },
  tile: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    minHeight: 96,
    gap: 8,
  },
  emoji: {
    fontSize: 26,
  },
  title: {
    ...Typography.caption,
    color: Colors.ink,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: 2,
  },
  pending: {
    opacity: 0.7,
  },
  sent: {
    backgroundColor: Colors.successSoft,
    borderColor: Colors.success,
  },
  failed: {
    backgroundColor: Colors.dangerSoft,
    borderColor: Colors.danger,
  },
});
