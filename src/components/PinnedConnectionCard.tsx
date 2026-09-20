import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Badge, Card } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/theme/colors';
import { derivePresenceStatus } from '@/services/presenceService';
import { getRelationshipDefinition } from '@/constants/relationships';
import type { Connection, UserProfile } from '@/types/models';
import { useAuthStore } from '@/stores/authStore';

export interface PinnedConnectionCardProps {
  connection: Connection;
  peer: UserProfile | null;
  todayCount?: number;
  onPress?: () => void;
}

export function PinnedConnectionCard({
  connection,
  peer,
  todayCount = 0,
  onPress,
}: PinnedConnectionCardProps) {
  const userId = useAuthStore((s) => s.user?.uid);
  const participant = userId
    ? connection.participants[userId]
    : undefined;
  const relationship = participant
    ? getRelationshipDefinition(participant.relationshipType)
    : undefined;
  const name =
    participant?.nickname || peer?.displayName || peer?.username || 'Someone';
  const presence = derivePresenceStatus(peer?.lastActiveAt);

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Avatar
          uri={peer?.avatarUrl}
          name={name}
          size={64}
          presence={presence}
        />
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {relationship ? (
            <Badge
              label={`${relationship.emoji} ${relationship.label}`}
              tone="rose"
            />
          ) : null}
          <Text style={styles.count}>
            {todayCount === 0
              ? 'No sparks yet today'
              : `${todayCount} spark${todayCount === 1 ? '' : 's'} today`}
          </Text>
        </View>
        <Text style={styles.pin} accessibilityLabel="Pinned">
          📌
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.peach,
    borderColor: Colors.coralSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  meta: {
    flex: 1,
    gap: Spacing.xs,
  },
  name: {
    ...Typography.heading,
    color: Colors.ink,
  },
  count: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  pin: {
    fontSize: 18,
  },
});
