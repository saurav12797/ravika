import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Badge, Card } from '@/components/ui';
import { Colors, Radii, Spacing, TouchTarget, Typography } from '@/theme/colors';
import { derivePresenceStatus } from '@/services/presenceService';
import { getRelationshipDefinition } from '@/constants/relationships';
import type { Connection, UserProfile } from '@/types/models';
import { useAuthStore } from '@/stores/authStore';

export interface ConnectionCardProps {
  connection: Connection;
  peer: UserProfile | null;
  onPress?: () => void;
  onTogglePin?: () => void;
  /** Quick send feelings without opening the full screen. */
  onSendFeeling?: () => void;
  pinBusy?: boolean;
}

export function ConnectionCard({
  connection,
  peer,
  onPress,
  onTogglePin,
  onSendFeeling,
  pinBusy,
}: ConnectionCardProps) {
  const userId = useAuthStore((s) => s.user?.uid);
  const participant = userId
    ? connection.participants[userId]
    : undefined;
  const pinned = Boolean(participant?.pinned);
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
          size={52}
          presence={presence}
        />
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{peer?.username ?? '…'}
          </Text>
          {relationship ? (
            <Badge
              label={`${relationship.emoji} ${relationship.label}`}
              tone="coral"
            />
          ) : null}
        </View>
        {onTogglePin ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pinned ? 'Unpin connection' : 'Pin connection'}
            disabled={pinBusy}
            hitSlop={8}
            onPress={() => {
              onTogglePin();
            }}
            style={styles.pinBtn}
          >
            <Text style={styles.pinIcon}>{pinned ? '📌' : '📍'}</Text>
          </Pressable>
        ) : null}
      </View>
      {onSendFeeling ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Tell ${name} something`}
          onPress={(e) => {
            e?.stopPropagation?.();
            onSendFeeling();
          }}
          style={styles.feelBtn}
        >
          <Text style={styles.feelBtnText}>Tell them 💕</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  meta: {
    flex: 1,
    gap: Spacing.xxs,
  },
  name: {
    ...Typography.bodyStrong,
    color: Colors.ink,
  },
  username: {
    ...Typography.caption,
    color: Colors.inkSubtle,
  },
  pinBtn: {
    minWidth: TouchTarget.min,
    minHeight: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: {
    fontSize: 22,
  },
  feelBtn: {
    marginTop: Spacing.md,
    alignSelf: 'stretch',
    backgroundColor: Colors.blush,
    borderRadius: Radii.full,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  feelBtnText: {
    ...Typography.label,
    color: Colors.roseDark,
  },
});
