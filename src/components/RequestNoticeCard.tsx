import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button } from '@/components/ui';
import {
  getAcceptAsOptions,
  getReciprocalRelationship,
  getRelationshipDefinition,
} from '@/constants/relationships';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type {
  ConnectionRequest,
  RelationshipType,
  UserProfile,
} from '@/types/models';

type IncomingProps = {
  mode: 'incoming';
  request: ConnectionRequest;
  peer?: UserProfile | null;
  onAccept: (asRelationship: RelationshipType) => void;
  onDecline: () => void;
};

type OutgoingProps = {
  mode: 'outgoing';
  request: ConnectionRequest;
  peer?: UserProfile | null;
  onCancel: () => void;
};

type Props = IncomingProps | OutgoingProps;

export function RequestNoticeCard(props: Props) {
  const { request, peer } = props;
  const bond = getRelationshipDefinition(request.proposedRelationshipType);
  const name = peer?.displayName ?? 'Someone';
  const handle = peer?.username ? `@${peer.username}` : '';

  const defaultAs = useMemo(
    () => getReciprocalRelationship(request.proposedRelationshipType),
    [request.proposedRelationshipType],
  );
  const acceptOptions = useMemo(
    () => getAcceptAsOptions(request.proposedRelationshipType),
    [request.proposedRelationshipType],
  );
  const [acceptAs, setAcceptAs] = useState<RelationshipType>(defaultAs);
  useEffect(() => {
    setAcceptAs(defaultAs);
  }, [defaultAs, request.id]);
  const acceptAsDef = getRelationshipDefinition(acceptAs);

  if (props.mode === 'incoming') {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Avatar uri={peer?.avatarUrl} name={name} size={48} />
          <View style={styles.meta}>
            <Text style={styles.body}>
              <Text style={styles.strong}>{name}</Text>
              {handle ? <Text style={styles.handle}> {handle}</Text> : null}
              {' wants you as their '}
              <Text style={styles.strong}>
                {bond?.emoji} {bond?.label ?? 'someone special'}
              </Text>
            </Text>
            <Text style={styles.time}>
              Accept as your {acceptAsDef?.emoji}{' '}
              {acceptAsDef?.label ?? 'person'}
            </Text>
          </View>
        </View>

        <View style={styles.asRow}>
          {acceptOptions.map((id) => {
            const def = getRelationshipDefinition(id);
            const selected = id === acceptAs;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Accept as ${def?.label ?? id}`}
                onPress={() => setAcceptAs(id)}
                style={[styles.asChip, selected && styles.asChipOn]}
              >
                <Text style={[styles.asText, selected && styles.asTextOn]}>
                  {def?.emoji} {def?.label ?? id}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Button
            title={`Accept as ${acceptAsDef?.label ?? 'them'}`}
            size="md"
            onPress={() => props.onAccept(acceptAs)}
            style={styles.flexBtn}
          />
          <Button
            title="Not now"
            size="md"
            variant="secondary"
            onPress={props.onDecline}
            style={styles.flexBtn}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={peer?.avatarUrl} name={name} size={48} />
        <View style={styles.meta}>
          <Text style={styles.body}>
            {'You asked '}
            <Text style={styles.strong}>{name}</Text>
            {handle ? <Text style={styles.handle}> {handle}</Text> : null}
            {' to be your '}
            <Text style={styles.strong}>
              {bond?.emoji} {bond?.label ?? 'person'}
            </Text>
          </Text>
          <Text style={styles.time}>Sent - waiting for them</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cancel request to ${name}`}
          onPress={props.onCancel}
          hitSlop={8}
        >
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  meta: { flex: 1, gap: 4 },
  body: {
    ...Typography.body,
    color: Colors.ink,
  },
  strong: {
    ...Typography.bodyStrong,
    color: Colors.ink,
  },
  handle: {
    ...Typography.caption,
    color: Colors.inkSubtle,
  },
  time: {
    ...Typography.caption,
    color: Colors.roseDark,
    fontStyle: 'italic',
  },
  asRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  asChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cream,
  },
  asChipOn: {
    borderColor: Colors.rose,
    backgroundColor: Colors.blush,
  },
  asText: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  asTextOn: {
    color: Colors.roseDark,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  flexBtn: { flex: 1 },
  cancel: {
    ...Typography.label,
    color: Colors.inkMuted,
    marginTop: 4,
  },
});
