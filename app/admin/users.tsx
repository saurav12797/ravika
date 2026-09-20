import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, EmptyState, TextField } from '@/components/ui';
import { findByUsername, findByPhone } from '@/services/discoveryService';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type { UserProfile } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

/**
 * Admin user lookup - search by username or phone.
 * Full directory listing is intentionally not exposed client-side.
 */
export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  const search = async () => {
    setLoading(true);
    try {
      const q = query.trim();
      let found =
        (await findByUsername(q.replace(/^@/, ''))) ??
        (/^\+?\d/.test(q) ? await findByPhone(q) : null);
      setUser(found);
      if (!found) {
        Alert.alert('Not found', 'No user matched that query.');
      }
    } catch (err) {
      Alert.alert('Error', toUserMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing['3xl'] },
      ]}
    >
      <Text style={styles.blurb}>
        Look up a single user by username or phone. Bulk exports stay server-side.
      </Text>
      <TextField
        label="Username or phone"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />
      <Button title="Look up" loading={loading} onPress={() => void search()} fullWidth />

      {!user ? (
        <EmptyState emoji="👥" title="No user selected" />
      ) : (
        <View style={styles.card}>
          <Avatar uri={user.avatarUrl} name={user.displayName} size={64} />
          <Text style={styles.name}>{user.displayName}</Text>
          <Text style={styles.meta}>@{user.username}</Text>
          <Text style={styles.meta}>id: {user.id}</Text>
          <Text style={styles.meta}>
            admin: {user.isAdmin ? 'yes' : 'no'}
          </Text>
          <Text style={styles.meta}>phone hash: {user.phoneHash.slice(0, 12)}…</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.md },
  blurb: { ...Typography.body, color: Colors.inkMuted },
  card: {
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing['2xl'],
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: { ...Typography.heading, color: Colors.ink },
  meta: { ...Typography.caption, color: Colors.inkMuted },
});
