import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PREDEFINED_REACTIONS } from '@/constants/reactions';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';

export default function AdminReactionsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={{
        padding: Spacing.xl,
        paddingBottom: insets.bottom + Spacing['3xl'],
        gap: Spacing.sm,
      }}
      data={PREDEFINED_REACTIONS}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <Text style={styles.header}>
          Built-in reaction catalog ({PREDEFINED_REACTIONS.length})
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.emoji}>{item.emoji}</Text>
          <View style={styles.meta}>
            <Text style={styles.title}>
              {item.title}
              {item.isMeta ? ' · meta' : ''}
            </Text>
            <Text style={styles.sub}>
              id {String(item.id)} · {item.category} · {item.animationId}
            </Text>
            <Text style={styles.sub}>{item.notificationTemplate}</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    ...Typography.heading,
    color: Colors.ink,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emoji: { fontSize: 28 },
  meta: { flex: 1, gap: 2 },
  title: { ...Typography.bodyStrong, color: Colors.ink },
  sub: { ...Typography.caption, color: Colors.inkMuted },
});
