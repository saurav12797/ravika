import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';

export function ConnectionSubnav({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const tabs = [
    { path: `/connection/${connectionId}` as const, label: 'Home' },
    { path: `/chat/${connectionId}` as const, label: 'Chat' },
    { path: `/connection/${connectionId}/reactions` as const, label: 'Feelings' },
    { path: `/connection/${connectionId}/activity` as const, label: 'Activity' },
    { path: `/connection/${connectionId}/stats` as const, label: 'Stats' },
  ];

  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((t) => (
        <Pressable
          key={t.label}
          accessibilityRole="tab"
          accessibilityLabel={t.label}
          onPress={() => router.push(t.path)}
          style={styles.tab}
        >
          <Text style={styles.tabText}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.blush,
    borderRadius: Radii.full,
  },
  tabText: {
    ...Typography.caption,
    color: Colors.roseDark,
    fontWeight: '700',
  },
});
