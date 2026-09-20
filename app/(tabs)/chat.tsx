import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, LoadingState } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useConnections } from '@/hooks/useConnections';
import { subscribeToChatThreads } from '@/services/chatService';
import { derivePresenceStatus } from '@/services/presenceService';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type { ChatThread } from '@/types/models';

/**
 * WhatsApp-style chat list — one row per connection with last message preview.
 */
export default function ChatListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.uid);
  const { withPeers, loading } = useConnections();
  const [threads, setThreads] = useState<Record<string, ChatThread | null>>(
    {},
  );

  const connectionIds = useMemo(
    () => withPeers.map((p) => p.connection.id),
    [withPeers],
  );

  useEffect(() => {
    if (connectionIds.length === 0) {
      setThreads({});
      return;
    }
    return subscribeToChatThreads(connectionIds, setThreads);
  }, [connectionIds.join(',')]);

  const rows = useMemo(() => {
    return [...withPeers].sort((a, b) => {
      const aThread = threads[a.connection.id];
      const bThread = threads[b.connection.id];
      const aAt =
        aThread?.lastMessageAt ??
        a.connection.lastInteractionAt ??
        a.connection.updatedAt ??
        0;
      const bAt =
        bThread?.lastMessageAt ??
        b.connection.lastInteractionAt ??
        b.connection.updatedAt ??
        0;
      return bAt - aAt;
    });
  }, [withPeers, threads]);

  if (loading && rows.length === 0) {
    return <LoadingState label="Loading chats…" />;
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.pad}>
        <ScreenHeader
          title="Chats"
          subtitle="Latest messages · blue ticks when read"
        />
      </View>

      {rows.length === 0 ? (
        <EmptyState
          emoji="💬"
          title="No chats yet"
          description="Connect with someone first, then tap them here to chat."
          actionLabel="Find someone"
          onAction={() => router.push('/find-users')}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.connection.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 96 },
          ]}
          renderItem={({ item }) => {
            const name =
              item.peer?.displayName ||
              item.peer?.username ||
              'Someone';
            const presence = derivePresenceStatus(item.peer?.lastActiveAt);
            const thread = threads[item.connection.id];
            const unread = userId
              ? Number(thread?.unreadCounts?.[userId] ?? 0)
              : 0;
            const last = thread?.lastMessage?.trim();
            const mine = Boolean(
              userId && thread?.lastFromUserId === userId && last,
            );
            const preview = last
              ? mine
                ? `You: ${last}`
                : last
              : 'Tap to start chatting';
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push(`/chat/${item.connection.id}`)
                }
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${name}`}
              >
                <Avatar
                  uri={item.peer?.avatarUrl}
                  name={name}
                  size={52}
                  presence={presence}
                />
                <View style={styles.meta}>
                  <Text style={styles.name} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text
                    style={[
                      styles.preview,
                      unread > 0 && styles.previewUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {preview}
                  </Text>
                </View>
                {unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unread > 99 ? '99+' : unread}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  pad: { paddingHorizontal: Spacing.xl },
  list: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  meta: { flex: 1, minWidth: 0, gap: 2 },
  name: {
    ...Typography.bodyStrong,
    color: Colors.ink,
    fontSize: 17,
  },
  preview: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  previewUnread: {
    color: Colors.ink,
    fontWeight: '700',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '800',
    fontSize: 11,
  },
  chevron: {
    ...Typography.heading,
    color: Colors.inkSubtle,
    fontSize: 22,
  },
});
