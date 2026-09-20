import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState, LoadingState } from '@/components/ui';
import { getAdminSettings } from '@/services/adminService';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';

const LINKS = [
  { href: '/admin/notifications' as const, title: 'Notifications', emoji: '🔔' },
  { href: '/admin/rate-limits' as const, title: 'Rate limits', emoji: '⏱️' },
  { href: '/admin/reactions' as const, title: 'Reactions catalog', emoji: '💕' },
  { href: '/admin/users' as const, title: 'Users', emoji: '👥' },
];

export default function AdminHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getAdminSettings,
  });

  if (settingsQuery.isLoading) return <LoadingState />;
  if (settingsQuery.isError) {
    return (
      <ErrorState
        error={settingsQuery.error}
        onRetry={() => void settingsQuery.refetch()}
      />
    );
  }

  const settings = settingsQuery.data;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing['3xl'] },
      ]}
    >
      <Text style={styles.title}>Admin console</Text>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Maintenance</Text>
        <Text style={styles.statusValue}>
          {settings?.maintenanceMode ? 'ON' : 'Off'}
        </Text>
        <Text style={styles.statusLabel}>Signups</Text>
        <Text style={styles.statusValue}>
          {settings?.allowNewSignups ? 'Open' : 'Closed'}
        </Text>
        <Text style={styles.statusLabel}>Min version</Text>
        <Text style={styles.statusValue}>{settings?.minAppVersion}</Text>
      </View>

      {LINKS.map((link) => (
        <Pressable
          key={link.href}
          accessibilityRole="button"
          accessibilityLabel={link.title}
          onPress={() => router.push(link.href)}
          style={styles.link}
        >
          <Text style={styles.linkEmoji}>{link.emoji}</Text>
          <Text style={styles.linkTitle}>{link.title}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.md },
  title: { ...Typography.title, color: Colors.ink },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  statusLabel: { ...Typography.caption, color: Colors.inkSubtle },
  statusValue: { ...Typography.bodyStrong, color: Colors.ink, marginBottom: Spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkEmoji: { fontSize: 22 },
  linkTitle: { ...Typography.bodyStrong, color: Colors.ink, flex: 1 },
  chevron: { ...Typography.title, color: Colors.inkSubtle },
});
