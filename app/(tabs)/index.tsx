import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { RequestNoticeCard } from '@/components/RequestNoticeCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PersonFeelCard } from '@/components/PersonFeelCard';
import { QuickFeelSheet } from '@/components/QuickFeelSheet';
import { SentFeelingsSummary } from '@/components/SentFeelingsSummary';
import {
  useConnections,
  usePendingRequests,
} from '@/hooks/useConnections';
import {
  cancelRequest,
  respondToRequest,
} from '@/services/connectionService';
import { getUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { useRecentFeelingsStore } from '@/stores/recentFeelingsStore';
import { useSentCountsStore } from '@/stores/sentCountsStore';
import { Colors, Spacing, Typography } from '@/theme/colors';
import type { UserProfile, RelationshipType } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const userId = useAuthStore((s) => s.user?.uid);
  const { pinned, withPeers, loading, error, refreshPeers } = useConnections();
  const {
    incoming,
    outgoing,
    refresh: refreshRequests,
  } = usePendingRequests();

  const hydrateSent = useSentCountsStore((s) => s.hydrate);
  const mergeRemote = useSentCountsStore((s) => s.mergeRemote);

  const [refreshing, setRefreshing] = useState(false);
  const [sentRefreshKey, setSentRefreshKey] = useState(0);
  const [gridOrderKey, setGridOrderKey] = useState(0);
  const [feelTarget, setFeelTarget] = useState<{
    connectionId: string;
    toUserId: string;
    name: string;
    startOnCustom?: boolean;
  } | null>(null);

  const connectionIds = useMemo(
    () => withPeers.map((p) => p.connection.id),
    [withPeers],
  );

  const bumpSent = () => setSentRefreshKey((k) => k + 1);

  const peerProfiles = useQuery({
    queryKey: [
      'home-request-peers',
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

  /** Prefer pinned people for the one-tap hero; otherwise everyone. */
  const feelPeople = useMemo(() => {
    if (pinned.length > 0) return pinned;
    return withPeers;
  }, [pinned, withPeers]);

  useEffect(() => {
    void (async () => {
      await hydrateSent();
      const recentStore = useRecentFeelingsStore.getState();
      await recentStore.hydrate();
      if (
        useSentCountsStore.getState().total === 0 &&
        recentStore.items.length > 0
      ) {
        const by: Record<string, number> = {};
        for (const item of recentStore.items) {
          by[String(item.reactionType)] = item.count;
        }
        const total = Object.values(by).reduce((a, b) => a + b, 0);
        mergeRemote(by, total);
      }
    })();
  }, [hydrateSent, mergeRemote]);

  const onRefresh = async () => {
    setRefreshing(true);
    refreshPeers();
    refreshRequests();
    bumpSent();
    setGridOrderKey((k) => k + 1);
    setRefreshing(false);
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

  if (loading && withPeers.length === 0 && incoming.length === 0) {
    return <LoadingState label="Gathering your love notes…" />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refreshPeers} />;
  }

  const hasRequests = incoming.length > 0 || outgoing.length > 0;

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + 88,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
          />
        }
      >
        <ScreenHeader
          title={`Hey, ${profile?.displayName?.split(' ')[0] ?? 'love'}`}
          subtitle="One tap - a feeling flies to someone you love"
        />

        {hasRequests ? (
          <View style={styles.requestsBlock}>
            <Text style={styles.section}>Connection requests</Text>
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

        <Text style={styles.section}>Send a feeling</Text>
        {feelPeople.length === 0 ? (
          <EmptyState
            emoji="💌"
            title="Who do you want close?"
            description="Find someone, connect, then send love in one soft tap."
            actionLabel="Find them"
            onAction={() => router.push('/find-users')}
          />
        ) : (
          <View style={styles.stack}>
            {feelPeople.map((item) => {
              const peerId =
                item.connection.userIds.find((id) => id !== userId) ?? '';
              return (
                <PersonFeelCard
                  key={item.connection.id}
                  connection={item.connection}
                  peer={item.peer}
                  orderResetKey={gridOrderKey}
                  onOpenProfile={() =>
                    router.push(`/connection/${item.connection.id}`)
                  }
                  onMoreFeelings={() => {
                    if (!peerId) return;
                    setFeelTarget({
                      connectionId: item.connection.id,
                      toUserId: peerId,
                      name:
                        item.peer?.displayName ??
                        item.peer?.username ??
                        'them',
                    });
                  }}
                  onCustomFeeling={() => {
                    if (!peerId) return;
                    setFeelTarget({
                      connectionId: item.connection.id,
                      toUserId: peerId,
                      name:
                        item.peer?.displayName ??
                        item.peer?.username ??
                        'them',
                      startOnCustom: true,
                    });
                  }}
                  onSent={() => {
                    bumpSent();
                  }}
                />
              );
            })}
          </View>
        )}

        <Text style={styles.section}>What you’ve sent</Text>
        <SentFeelingsSummary
          connectionIds={connectionIds}
          userId={userId}
          refreshKey={sentRefreshKey}
        />
      </ScrollView>
      {feelTarget ? (
        <QuickFeelSheet
          visible
          connectionId={feelTarget.connectionId}
          toUserId={feelTarget.toUserId}
          peerName={feelTarget.name}
          startOnCustom={feelTarget.startOnCustom}
          onClose={() => {
            setFeelTarget(null);
            bumpSent();
          }}
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
  requestsBlock: {
    marginBottom: Spacing.sm,
  },
  section: {
    ...Typography.heading,
    color: Colors.ink,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  stack: {
    gap: Spacing.md,
  },
});
