import React, { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BrandLogo } from '@/components/BrandLogo';
import { Colors, Spacing } from '@/theme/colors';

/**
 * Launch screen — logo + name + tagline that always fits the viewport.
 * Soft wash (no hard pink disc), gentle float animation.
 */
export function LaunchSplash() {
  const { width } = useWindowDimensions();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const floatY = useSharedValue(0);
  const tagOpacity = useSharedValue(0);
  const glow = useSharedValue(0.5);

  const logoSize = Math.min(96, Math.max(68, Math.round(width * 0.22)));
  const titleSize = Math.min(34, Math.max(26, Math.round(width * 0.078)));
  const tagSize = Math.min(15, Math.max(13, Math.round(width * 0.034)));

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
    });
    tagOpacity.value = withDelay(
      280,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    floatY.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.45, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [opacity, scale, tagOpacity, floatY, glow]);

  const clusterStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: floatY.value }],
  }));

  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.35,
    transform: [{ scale: 0.92 + glow.value * 0.12 }],
  }));

  return (
    <View style={styles.root} accessibilityLabel="Ravika is loading">
      <LinearGradient
        colors={['#FFF9F6', '#FFE8EF', '#FFF3EC']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.washTop} pointerEvents="none" />
      <View style={styles.washBottom} pointerEvents="none" />

      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />

      <Animated.View style={[styles.cluster, clusterStyle]}>
        <BrandLogo size={logoSize} />
        <Text
          style={[
            styles.brand,
            { fontSize: titleSize, lineHeight: titleSize + 6 },
          ]}
          accessibilityRole="header"
        >
          Ravika
        </Text>
        <Animated.Text
          style={[
            styles.tagline,
            tagStyle,
            { fontSize: tagSize, lineHeight: tagSize + 7 },
          ]}
        >
          Let them know you're thinking of them
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF6F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  washTop: {
    position: 'absolute',
    top: -70,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 177, 153, 0.18)',
  },
  washBottom: {
    position: 'absolute',
    bottom: -80,
    right: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(232, 90, 122, 0.12)',
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(247, 168, 184, 0.45)',
  },
  cluster: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: Spacing.md,
  },
  brand: {
    fontWeight: '800',
    letterSpacing: -0.7,
    color: Colors.ink,
    textAlign: 'center',
    marginTop: 6,
  },
  tagline: {
    fontWeight: '500',
    color: Colors.inkMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
    flexWrap: 'wrap',
  },
});
