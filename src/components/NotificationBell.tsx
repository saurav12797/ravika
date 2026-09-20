import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useConnections, usePendingRequests } from '@/hooks/useConnections';
import { useAuthStore } from '@/stores/authStore';
import { useInboxStore } from '@/stores/inboxStore';
import { Colors } from '@/theme/colors';

/**
 * Always-visible Instagram-style notification bell with unread badge.
 */
export function NotificationBell() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.uid);
  const { incoming } = usePendingRequests();
  const { connections } = useConnections();
  const items = useInboxStore((s) => s.items);
  const lastReadAt = useInboxStore((s) => s.lastReadAt);

  const unreadFeelings = useMemo(() => {
    const fromInbox = items.filter((i) => i.createdAt > lastReadAt).length;
    const fromConnections = connections.reduce((sum, c) => {
      if (!userId) return sum;
      return sum + Number(c.unreadCounts?.[userId] ?? 0);
    }, 0);
    return Math.max(fromInbox, fromConnections);
  }, [items, lastReadAt, connections, userId]);

  const unread = Math.min(99, incoming.length + unreadFeelings);
  const showBadge = unread > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        showBadge
          ? `Notifications, ${unread} unread`
          : 'Open notifications'
      }
      hitSlop={10}
      onPress={() => router.push('/(tabs)/activity')}
      style={styles.btn}
    >
      <Ionicons
        name={showBadge ? 'notifications' : 'notifications-outline'}
        size={24}
        color={Colors.rose}
      />
      {showBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
