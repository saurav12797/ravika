import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Button, ErrorState, LoadingState } from '@/components/ui';
import { ConnectionSubnav } from '@/components/ConnectionSubnav';
import { RelationshipPicker } from '@/components/RelationshipPicker';
import { StatChip } from '@/components/StatChip';
import { useConnectionDetail } from '@/hooks/useConnectionDetail';
import { useConnections } from '@/hooks/useConnections';
import { derivePresenceStatus, describePresence } from '@/services/presenceService';
import { getConnectionFeelingBreakdown } from '@/services/interactionService';
import { updateMyRelationshipType } from '@/services/connectionService';
import {
  getReactionDefinition,
  getShortReactionLabel,
} from '@/constants/reactions';
import { getRelationshipDefinition } from '@/constants/relationships';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type { RelationshipType } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

export default function ConnectionProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.uid);
  const { connection, peer, loading, error, reload } = useConnectionDetail(id);
  const { refreshPeers } = useConnections();
  const [savingRel, setSavingRel] = useState(false);

  const feelings = useQuery({
    queryKey: ['connection-feelings', id, userId],
    enabled: Boolean(id),
    queryFn: () =>
      getConnectionFeelingBreakdown(id!, {
        fromUserId: userId,
      }),
  });

  if (loading) return <LoadingState />;
  if (error || !connection || !id) {
    return <ErrorState error={error} onRetry={reload} />;
  }

  const participant = userId ? connection.participants[userId] : undefined;
  const relationship = participant
    ? getRelationshipDefinition(participant.relationshipType)
    : undefined;
  const name = participant?.nickname || peer?.displayName || 'Someone';
  const presence = derivePresenceStatus(peer?.lastActiveAt);

  const onChangeRelationship = async (next: RelationshipType) => {
    if (!id || savingRel) return;
    if (participant?.relationshipType === next) return;
    setSavingRel(true);
    try {
      await updateMyRelationshipType(id, next);
      refreshPeers();
      reload();
    } catch (err) {
      Alert.alert('Could not update', toUserMessage(err));
    } finally {
      setSavingRel(false);
    }
  };

  const chips = Object.entries(feelings.data?.byReaction ?? {})
    .filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const custom = feelings.data?.labels?.[key];
      if (custom) {
        return {
          key,
          emoji: custom.emoji || '💕',
          label: custom.title || 'Custom feeling',
          value: count,
        };
      }
      const def = getReactionDefinition(
        (Number.isNaN(Number(key)) ? key : Number(key)) as never,
      );
      return {
        key,
        emoji: def && !def.isMeta ? def.emoji : '💕',
        label:
          def && !def.isMeta
            ? getShortReactionLabel(key)
            : 'Custom feeling',
        value: count,
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        <ConnectionSubnav connectionId={id} />
        <View style={styles.hero}>
          <Avatar
            uri={peer?.avatarUrl}
            name={name}
            size={104}
            presence={presence}
          />
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.username}>@{peer?.username ?? '…'}</Text>
          <Text style={styles.presence}>
            {describePresence(peer?.lastActiveAt)}
          </Text>
          {relationship ? (
            <Text style={styles.rel}>
              {relationship.emoji} {relationship.label}
            </Text>
          ) : null}
          {peer?.bio ? <Text style={styles.bio}>{peer.bio}</Text> : null}
        </View>

        <View style={styles.relCard}>
          <RelationshipPicker
            value={participant?.relationshipType ?? 'friend'}
            onChange={(next) => void onChangeRelationship(next)}
            label="They are my"
          />
          <Text style={styles.relHint}>
            Change anytime — friend, best friend, love, family, and more.
            {savingRel ? ' Saving…' : ''}
          </Text>
        </View>

        {chips.length > 0 ? (
          <View style={styles.statsBlock}>
            <Text style={styles.statsTitle}>What you’ve sent them</Text>
            <View style={styles.statsRow}>
              {chips.map((chip) => (
                <StatChip
                  key={chip.key}
                  emoji={chip.emoji}
                  label={chip.label}
                  value={chip.value}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            title="Tell them something"
            fullWidth
            onPress={() => router.push(`/connection/${id}/reactions`)}
            accessibilityLabel="Open feelings"
          />
          <Button
            title="View activity"
            variant="secondary"
            fullWidth
            onPress={() => router.push(`/connection/${id}/activity`)}
          />
          <Button
            title="Stats"
            variant="ghost"
            fullWidth
            onPress={() => router.push(`/connection/${id}/stats`)}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  hero: {
    alignItems: 'center',
    padding: Spacing['2xl'],
    gap: Spacing.xs,
  },
  name: {
    ...Typography.title,
    color: Colors.ink,
    marginTop: Spacing.md,
  },
  username: {
    ...Typography.caption,
    color: Colors.inkSubtle,
  },
  presence: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  rel: {
    ...Typography.label,
    color: Colors.roseDark,
    marginTop: Spacing.sm,
  },
  bio: {
    ...Typography.body,
    color: Colors.inkMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  relCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radii.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  relHint: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  statsBlock: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  statsTitle: {
    ...Typography.heading,
    color: Colors.ink,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actions: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
});
