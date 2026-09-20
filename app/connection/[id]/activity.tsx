import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { ActivityItem } from '@/components/ActivityItem';
import { ConnectionSubnav } from '@/components/ConnectionSubnav';
import { useConnectionDetail } from '@/hooks/useConnectionDetail';
import { useConnectionInteractions } from '@/hooks/useConnectionInteractions';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Spacing } from '@/theme/colors';
import { dayKey, monthKey, weekKey } from '@/utils/dates';

type Filter = 'today' | 'week' | 'month' | 'all';

export default function ConnectionActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.uid);
  const { peer, loading: detailLoading, error: detailError, reload } =
    useConnectionDetail(id);
  const { items, loading, error } = useConnectionInteractions(id, 60);
  const [filter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'today') return item.dayKey === dayKey();
      if (filter === 'week') return weekKey(item.createdAt) === weekKey();
      if (filter === 'month') return monthKey(item.createdAt) === monthKey();
      return true;
    });
  }, [items, filter]);

  if (detailLoading || loading) return <LoadingState />;
  if (detailError || error || !id) {
    return <ErrorState error={detailError ?? error} onRetry={reload} />;
  }

  return (
    <View style={styles.flex}>
      <ConnectionSubnav connectionId={id} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        renderItem={({ item }) => (
          <ActivityItem
            item={item}
            selfUserId={userId}
            peerName={peer?.displayName}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            emoji="💭"
            title="No activity yet"
            description="Send the first feeling from Feelings."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});
