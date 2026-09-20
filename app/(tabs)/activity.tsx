import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, LoadingState } from '@/components/ui';
import { ActivityItem } from '@/components/ActivityItem';
import { RequestNoticeCard } from '@/components/RequestNoticeCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  useConnections,
  usePendingRequests,
} from '@/hooks/useConnections';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import {
  cancelRequest,
  clearUnreadForUser,
  respondToRequest,
} from '@/services/connectionService';
import { getUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { useInboxStore } from '@/stores/inboxStore';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type { Interaction, RelationshipType, UserProfile } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

/**
 * Notifications inbox (header bell) — Instagram-style:
 * items stay in the list; unread vs read use different backgrounds.
 */
export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.uid);
  const { withPeers, connections, loading: connectionsLoading, refreshPeers } =
    useConnections();
  const {
    incoming,
    outgoing,
    loading: requestsLoading,
  } = usePendingRequests();
  const { items: inbox, loading: inboxLoading } = useRealtimeInbox();
  const markAllRead = useInboxStore((s) => s.markAllRead);
  const hydrateLastRead = useInboxStore((s) => s.hydrateLastRead);
  const lastReadAt = useInboxStore((s) => s.lastReadAt);
  /** Freeze unread watermark for this visit so unread cards stay tinted while viewing. */
  const [visitWatermark, setVisitWatermark] = useState<number | null>(null);
  const markedRef = useRef(false);

  const closeNotifications = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await hydrateLastRead();
        const watermark = useInboxStore.getState().lastReadAt;
        setVisitWatermark(watermark);
        if (!markedRef.current) {
          markedRef.current = true;
          void markAllRead();
          void clearUnreadForUser(connections.map((c) => c.id));
        }
      })();
      return () => {
        markedRef.current = false;
      };
    }, [hydrateLastRead, markAllRead, connections]),
  );

  const peerProfiles = useQuery({
    queryKey: [
      'notif-peers',
      incoming.map((r) => r.fromUserId).join(','),
      outgoing.map((r) => r.toUserId).join(','),
      inbox.map((i) => i.fromUserId).join(','),
    ],
    queryFn: async () => {
      const ids = [
        ...incoming.map((r) => r.fromUserId),
        ...outgoing.map((r) => r.toUserId),
        ...inbox.map((i) => i.fromUserId),
      ];
      const map: Record<string, UserProfile | null> = {};
      await Promise.all(
        [...new Set(ids)].map(async (id) => {
          map[id] = await getUser(id);
        }),
      );
      return map;
    },
    enabled: incoming.length + outgoing.length + inbox.length > 0,
  });

  const accept = async (
    requestId: string,
    asRelationship?: RelationshipType,
  ) => {
    try {
      await respondToRequest(requestId, 'accept', asRelationship);
      refreshPeers();
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Could not accept', toUserMessage(err));
    }
  };

  const decline = async (requestId: string) => {
    try {
      await respondToRequest(requestId, 'decline');
    } catch (err) {
      Alert.alert('Could not decline', toUserMessage(err));
    }
  };

  const cancel = async (requestId: string) => {
    try {
      await cancelRequest(requestId);
    } catch (err) {
      Alert.alert('Could not cancel', toUserMessage(err));
    }
  };

  const peerNameFor = useCallback(
    (connectionId: string) =>
      withPeers.find((c) => c.connection.id === connectionId)?.peer
        ?.displayName,
    [withPeers],
  );

  const isUnread = useCallback(
    (item: Interaction) => {
      if (item.fromUserId === userId) return false;
      const mark = visitWatermark ?? lastReadAt;
      return item.createdAt > mark;
    },
    [visitWatermark, lastReadAt, userId],
  );

  const header = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <ScreenHeader
          title="Notifications"
          subtitle="Unread stay highlighted — nothing vanishes"
          showNotifications={false}
          right={
            <Pressable
              onPress={closeNotifications}
              accessibilityRole="button"
              accessibilityLabel="Close notifications"
              hitSlop={10}
              style={styles.xBtn}
            >
              <Text style={styles.xText}>✕</Text>
            </Pressable>
          }
        />

        {incoming.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.section}>Requests</Text>
            {incoming.map((req) => (
              <RequestNoticeCard
                key={req.id}
                mode="incoming"
                request={req}
                peer={peerProfiles.data?.[req.fromUserId]}
                onAccept={(as) => void accept(req.id, as)}
                onDecline={() => void decline(req.id)}
              />
            ))}
          </View>
        ) : null}

        {outgoing.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.section}>Waiting on them</Text>
            {outgoing.map((req) => (
              <RequestNoticeCard
                key={req.id}
                mode="outgoing"
                request={req}
                peer={peerProfiles.data?.[req.toUserId]}
                onCancel={() => void cancel(req.id)}
              />
            ))}
          </View>
        ) : null}

        <Text style={styles.section}>Feelings for you</Text>
        {inboxLoading && inbox.length === 0 ? (
          <ActivityIndicator color={Colors.rose} style={{ marginVertical: 12 }} />
        ) : null}
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      incoming,
      outgoing,
      peerProfiles.data,
      inboxLoading,
      inbox.length,
      closeNotifications,
    ],
  );

  if (connectionsLoading && requestsLoading && inboxLoading) {
    return <LoadingState label="Loading your notifications…" />;
  }

  const empty =
    incoming.length === 0 && outgoing.length === 0 && inbox.length === 0;

  return (
    <View style={[styles.flex, { paddingTop: insets.top + Spacing.lg }]}>
      <FlatList
        data={inbox}
        keyExtractor={(item: Interaction) => item.id}
        contentContainerStyle={[
          styles.pad,
          { paddingBottom: insets.bottom + 96 },
          empty ? styles.emptyPad : null,
        ]}
        ListHeaderComponent={header}
        ListEmptyComponent={
          empty && !inboxLoading ? (
            <EmptyState
              emoji="🔔"
              title="You’re all caught up"
              description="When someone sends a feeling or a request, it shows up here. Unread ones stay highlighted until you’ve opened this screen."
              actionLabel="Find someone"
              onAction={() => router.push('/find-users')}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ActivityItem
            item={item}
            selfUserId={userId}
            peerName={
              peerProfiles.data?.[item.fromUserId]?.displayName ??
              peerNameFor(item.connectionId)
            }
            unread={isUnread(item)}
            onPress={() => router.push(`/connection/${item.connectionId}`)}
          />
        )}
        ListFooterComponent={
          inboxLoading && inbox.length > 0 ? (
            <ActivityIndicator color={Colors.rose} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  pad: { paddingHorizontal: Spacing.xl },
  emptyPad: { flexGrow: 1 },
  headerBlock: { marginBottom: Spacing.sm },
  block: { marginBottom: Spacing.md },
  section: {
    ...Typography.heading,
    color: Colors.ink,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  xBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    backgroundColor: Colors.blush,
    borderWidth: 1,
    borderColor: Colors.roseLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xText: {
    ...Typography.label,
    color: Colors.roseDark,
    fontSize: 18,
    fontWeight: '700',
  },
});
