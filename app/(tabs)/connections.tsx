import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui';
import { PersonFeelCard } from '@/components/PersonFeelCard';
import { RequestNoticeCard } from '@/components/RequestNoticeCard';
import { QuickFeelSheet } from '@/components/QuickFeelSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  useConnections,
  usePendingRequests,
} from '@/hooks/useConnections';
import {
  pinConnection,
  respondToRequest,
  cancelRequest,
  unpinConnection,
} from '@/services/connectionService';
import { getUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type { RelationshipType, UserProfile } from '@/types/models';
import { toUserMessage } from '@/utils/errors';
import { useQuery } from '@tanstack/react-query';

export default function ConnectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.uid);
  const { withPeers, loading, error, refreshPeers } = useConnections();
  const {
    incoming,
    outgoing,
    loading: requestsLoading,
    refresh: refreshRequests,
  } = usePendingRequests();

  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feelTarget, setFeelTarget] = useState<{
    connectionId: string;
    toUserId: string;
    name: string;
    startOnCustom?: boolean;
  } | null>(null);

  const peerProfiles = useQuery({
    queryKey: [
      'request-peers',
      incoming.map((r) => r.fromUserId).join(','),
      outgoing.map((r) => r.toUserId).join(','),
    ],
    queryFn: async () => {
      const ids = [
        ...incoming.map((r) => r.fromUserId),
        ...outgoing.map((r) => r.toUserId),
      ];
      const map: Record<string, UserProfile | null> = {};
      await Promise.all(
        [...new Set(ids)].map(async (id) => {
          map[id] = await getUser(id);
        }),
      );
      return map;
    },
    enabled: incoming.length + outgoing.length > 0,
  });

  const togglePin = async (connectionId: string, currentlyPinned: boolean) => {
    setPinBusyId(connectionId);
    setActionError(null);
    try {
      if (currentlyPinned) {
        await unpinConnection(connectionId);
      } else {
        await pinConnection(connectionId);
      }
    } catch (err) {
      setActionError(toUserMessage(err));
      Alert.alert('Could not update pin', toUserMessage(err));
    } finally {
      setPinBusyId(null);
    }
  };

  const accept = async (
    requestId: string,
    asRelationship?: RelationshipType,
  ) => {
    try {
      await respondToRequest(requestId, 'accept', asRelationship);
      refreshRequests();
      refreshPeers();
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Could not accept', toUserMessage(err));
    }
  };

  const decline = async (requestId: string) => {
    try {
      await respondToRequest(requestId, 'decline');
      refreshRequests();
    } catch (err) {
      Alert.alert('Could not decline', toUserMessage(err));
    }
  };

  const cancel = async (requestId: string) => {
    try {
      await cancelRequest(requestId);
      refreshRequests();
    } catch (err) {
      Alert.alert('Could not cancel', toUserMessage(err));
    }
  };

  if (loading && withPeers.length === 0) {
    return <LoadingState label="Loading connections…" />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refreshPeers} />;
  }

  const pendingTotal = incoming.length + outgoing.length;

  return (
    <>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + 88 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            refreshPeers();
            refreshRequests();
          }}
        />
      }
    >
      <ScreenHeader
        title="Your people"
        subtitle="One tap - send a feeling that flies to them"
        right={
          <Button
            title="Find"
            size="md"
            onPress={() => router.push('/find-users')}
            accessibilityLabel="Find users"
          />
        }
      />

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      <Pressable
        style={styles.notifLink}
        onPress={() =>
          router.push({
            pathname: '/(tabs)/activity',
            params: { focus: 'requests' },
          })
        }
        accessibilityRole="button"
        accessibilityLabel="Open requests and notifications"
      >
        <Text style={styles.notifLinkTitle}>
          Notifications
          {pendingTotal > 0 ? ` · ${pendingTotal}` : ''}
        </Text>
        <Text style={styles.notifLinkSub}>
          Open from the bell anytime - unread shows on top
        </Text>
      </Pressable>

      {(incoming.length > 0 || outgoing.length > 0 || requestsLoading) && (
        <View style={styles.section}>
          {incoming.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>For you</Text>
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
            </>
          ) : null}

          {outgoing.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Sent</Text>
              {outgoing.map((req) => (
                <RequestNoticeCard
                  key={req.id}
                  mode="outgoing"
                  request={req}
                  peer={peerProfiles.data?.[req.toUserId]}
                  onCancel={() => void cancel(req.id)}
                />
              ))}
            </>
          ) : null}
        </View>
      )}

      <Text style={styles.sectionTitle}>Your people</Text>
      {withPeers.length === 0 ? (
        <EmptyState
          emoji="💕"
          title="No connections yet"
          description="Find someone and ask to be close."
          actionLabel="Find someone"
          onAction={() => router.push('/find-users')}
        />
      ) : (
        withPeers.map((item) => {
          const peerId =
            item.connection.userIds.find((id) => id !== userId) ?? '';
          const isPinned = Boolean(
            userId && item.connection.participants[userId]?.pinned,
          );
          return (
            <PersonFeelCard
              key={item.connection.id}
              connection={item.connection}
              peer={item.peer}
              pinned={isPinned}
              pinBusy={pinBusyId === item.connection.id}
              onOpenProfile={() =>
                router.push(`/connection/${item.connection.id}`)
              }
              onTogglePin={() => void togglePin(item.connection.id, isPinned)}
              onMoreFeelings={() => {
                if (!peerId) return;
                setFeelTarget({
                  connectionId: item.connection.id,
                  toUserId: peerId,
                  name: item.peer?.displayName ?? 'them',
                });
              }}
              onCustomFeeling={() => {
                if (!peerId) return;
                setFeelTarget({
                  connectionId: item.connection.id,
                  toUserId: peerId,
                  name: item.peer?.displayName ?? 'them',
                  startOnCustom: true,
                });
              }}
            />
          );
        })
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search for users"
        onPress={() => router.push('/find-users')}
        style={styles.findCta}
      >
        <Text style={styles.findCtaText}>🔍 Find someone</Text>
      </Pressable>
    </ScrollView>
    {feelTarget ? (
      <QuickFeelSheet
        visible
        connectionId={feelTarget.connectionId}
        toUserId={feelTarget.toUserId}
        peerName={feelTarget.name}
        startOnCustom={feelTarget.startOnCustom}
        onClose={() => setFeelTarget(null)}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  section: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.heading,
    color: Colors.ink,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  notifLink: {
    backgroundColor: Colors.blush,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  notifLinkTitle: {
    ...Typography.bodyStrong,
    color: Colors.roseDark,
  },
  notifLinkSub: {
    ...Typography.caption,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  findCta: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radii.xl,
    backgroundColor: Colors.blush,
    alignItems: 'center',
  },
  findCtaText: {
    ...Typography.label,
    color: Colors.roseDark,
  },
  error: {
    ...Typography.caption,
    color: Colors.danger,
  },
});
