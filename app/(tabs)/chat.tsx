import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState, LoadingState } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ActivityItem } from '@/components/ActivityItem';
import { useConnections } from '@/hooks/useConnections';
import { subscribeToChatThreads } from '@/services/chatService';
import { subscribeToReceivedFeelings } from '@/services/interactionService';
import { derivePresenceStatus } from '@/services/presenceService';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type { ChatThread, Interaction } from '@/types/models';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * WhatsApp-style chat list — one row per connection with last message preview.
 */
export default function ChatListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.uid);
  const { withPeers, loading } = useConnections();
  const [threads, setThreads] = useState<Record<string, ChatThread | null>>({});
  const [pane, setPane] = useState<'chats' | 'reactions'>('chats');
  const [received, setReceived] = useState<Interaction[]>([]);

  const connectionIds = useMemo(() => withPeers.map((p) => p.connection.id), [withPeers]);
  const connectionKey = connectionIds.join(',');

  useEffect(() => {
    if (connectionIds.length === 0) {
      setThreads({});
      return;
    }
    return subscribeToChatThreads(connectionIds, setThreads);
  }, [connectionIds, connectionKey]);

  useEffect(() => {
    if (!userId || connectionIds.length === 0) {
      setReceived([]);
      return;
    }
    return subscribeToReceivedFeelings(userId, connectionIds, setReceived);
  }, [userId, connectionIds, connectionKey]);

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
      <LinearGradient
        colors={['#FFF6EE', '#FFE8DE', '#FFE4EC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.pad}>
        <ScreenHeader title="Chats" subtitle="Latest messages · blue ticks when read" />
        <View style={styles.switch}>
          {(['chats', 'reactions'] as const).map((id) => {
            const active = pane === id;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setPane(id);
                }}
                style={[styles.switchButton, active && styles.switchButtonActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.switchText, active && styles.switchTextActive]}>
                  {id === 'chats' ? 'Chats' : 'Reactions'}
                </Text>
                {id === 'reactions' && received.length > 0 ? (
                  <View style={styles.switchBadge}>
                    <Text style={styles.switchBadgeText}>
                      {Math.min(received.length, 99)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {pane === 'reactions' ? (
        received.length === 0 ? (
          <EmptyState
            emoji="💌"
            title="No reactions yet"
            description="Feelings people send you will appear here."
          />
        ) : (
          <FlatList
            data={received}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
            renderItem={({ item }) => {
              const peer = withPeers.find(
                (entry) => entry.connection.id === item.connectionId,
              )?.peer;
              return (
                <ActivityItem
                  item={item}
                  selfUserId={userId}
                  peerName={peer?.displayName ?? peer?.username ?? 'Someone'}
                  onPress={() =>
                    router.push(`/connection/${item.connectionId}/reactions`)
                  }
                />
              );
            }}
          />
        )
      ) : rows.length === 0 ? (
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
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
          renderItem={({ item }) => {
            const name = item.peer?.displayName || item.peer?.username || 'Someone';
            const presence = derivePresenceStatus(item.peer?.lastActiveAt);
            const thread = threads[item.connection.id];
            const unread = userId ? Number(thread?.unreadCounts?.[userId] ?? 0) : 0;
            const last = thread?.lastMessage?.trim();
            const mine = Boolean(userId && thread?.lastFromUserId === userId && last);
            const preview = last
              ? mine
                ? `You: ${last}`
                : last
              : 'Tap to start chatting';
            return (
              <Pressable
                style={[styles.row, unread > 0 ? styles.rowUnread : styles.rowRead]}
                onPress={() => router.push(`/chat/${item.connection.id}`)}
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
                    style={[styles.preview, unread > 0 && styles.previewUnread]}
                    numberOfLines={1}
                  >
                    {preview}
                  </Text>
                </View>
                {unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
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
  switch: {
    flexDirection: 'row',
    backgroundColor: Colors.blush,
    borderRadius: Radii.full,
    padding: 4,
    marginTop: Spacing.lg,
  },
  switchButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  switchButtonActive: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.roseDark,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  switchText: { ...Typography.label, color: Colors.inkMuted },
  switchTextActive: { color: Colors.roseDark },
  switchBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  switchBadgeText: { ...Typography.overline, color: Colors.white, fontSize: 9 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  rowUnread: {
    backgroundColor: 'rgba(255,240,245,0.92)',
    borderColor: Colors.roseLight,
    shadowColor: Colors.roseDark,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  rowRead: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderColor: 'rgba(255,255,255,0.82)',
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
