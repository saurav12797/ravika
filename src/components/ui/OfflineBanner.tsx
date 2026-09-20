import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '@/theme/colors';
import { useUiStore } from '@/stores/uiStore';

export function OfflineBanner() {
  const offline = useUiStore((s) => s.offline);
  const insets = useSafeAreaInsets();

  if (!offline) {
    return null;
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { paddingTop: Math.max(insets.top, Spacing.sm) }]}
    >
      <Text style={styles.text}>You're offline - some actions may wait.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.ink,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  text: {
    ...Typography.caption,
    color: Colors.cream,
    textAlign: 'center',
    fontWeight: '600',
  },
});
