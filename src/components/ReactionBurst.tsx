import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import { useUiStore } from '@/stores/uiStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';

function firstName(full: string): string {
  const t = full.trim();
  if (!t) return 'them';
  return t.split(/\s+/)[0] || t;
}

/**
 * Celebration after send / incoming — message first, soft “for {name}” footer.
 */
export function ReactionBurst() {
  const incoming = useUiStore((s) => s.incomingReactionAnimation);
  const sent = useUiStore((s) => s.sentCelebration);
  const clearIncoming = useUiStore((s) => s.clearIncomingReaction);
  const clearSent = useUiStore((s) => s.clearSentCelebration);
  const reducedMotion = useReducedMotion();

  const payload = useMemo(() => {
    if (sent) {
      return {
        mode: 'sent' as const,
        emoji: sent.emoji,
        message: sent.message?.trim() || sent.title,
        footer: `for ${firstName(sent.toDisplayName)}`,
      };
    }
    if (incoming) {
      return {
        mode: 'incoming' as const,
        emoji: incoming.emoji,
        message: incoming.message?.trim() || incoming.title,
        footer: `from ${firstName(incoming.fromDisplayName)}`,
      };
    }
    return null;
  }, [sent, incoming]);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.55);
  const ring = useSharedValue(0.85);
  const emojiY = useSharedValue(10);
  const emojiSpin = useSharedValue(0);

  useEffect(() => {
    if (!payload) return;

    const clear = payload.mode === 'sent' ? clearSent : clearIncoming;
    const hold = 3800;

    if (reducedMotion) {
      opacity.value = 1;
      scale.value = 1;
      const timer = setTimeout(clear, 3000);
      return () => clearTimeout(timer);
    }

    opacity.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withDelay(hold - 420, withTiming(0, { duration: 340 })),
    );
    scale.value = withSequence(
      withTiming(1.1, { duration: 320, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
      withDelay(hold - 900, withTiming(0.94, { duration: 300 })),
    );
    emojiY.value = withSequence(
      withTiming(-6, { duration: 380, easing: Easing.out(Easing.cubic) }),
      withRepeat(
        withSequence(
          withTiming(4, { duration: 520, easing: Easing.inOut(Easing.sin) }),
          withTiming(-4, { duration: 520, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    emojiSpin.value = withSequence(
      withTiming(-8, { duration: 280 }),
      withTiming(8, { duration: 360 }),
      withTiming(0, { duration: 280 }),
    );
    ring.value = withRepeat(
      withSequence(
        withTiming(1.14, { duration: 650, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.92, { duration: 650, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    const timer = setTimeout(clear, hold);
    return () => clearTimeout(timer);
  }, [
    payload,
    reducedMotion,
    clearIncoming,
    clearSent,
    opacity,
    scale,
    ring,
    emojiY,
    emojiSpin,
  ]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ring.value }],
    opacity: 0.28 + (ring.value - 0.85) * 0.65,
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: emojiY.value },
      { rotate: `${emojiSpin.value}deg` },
    ],
  }));

  if (!payload) return null;

  const isSent = payload.mode === 'sent';

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, overlayStyle]}
    >
      <View style={styles.dim} />
      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={[styles.bubble, bubbleStyle]}>
        <Animated.Text style={[styles.emoji, emojiStyle]}>
          {payload.emoji}
        </Animated.Text>
        <Text style={styles.badge}>{isSent ? 'Sent' : 'New'}</Text>
        <Text style={styles.message} numberOfLines={4}>
          {payload.message}
        </Text>
        <View style={styles.footerPill}>
          <Text style={styles.footerText}>{payload.footer}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(45, 20, 35, 0.32)',
  },
  ring: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 3,
    borderColor: Colors.roseLight,
  },
  bubble: {
    width: '86%',
    maxWidth: 300,
    borderRadius: Radii['2xl'],
    backgroundColor: '#FFF8FA',
    borderWidth: 2.5,
    borderColor: Colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    shadowColor: Colors.roseDark,
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    gap: 8,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  badge: {
    ...Typography.overline,
    color: Colors.rose,
    letterSpacing: 1.4,
  },
  message: {
    ...Typography.label,
    color: Colors.ink,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    paddingHorizontal: Spacing.sm,
  },
  footerPill: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: Colors.blush,
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.roseDark,
    fontWeight: '700',
    fontSize: 13,
  },
});
