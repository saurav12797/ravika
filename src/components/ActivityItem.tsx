import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import { formatActivityTime } from '@/utils/dates';
import type { Interaction } from '@/types/models';

export interface ActivityItemProps {
  item: Interaction;
  selfUserId?: string;
  peerName?: string;
  unread?: boolean;
  onPress?: () => void;
}

/** Soft social-style line — always prefer the full variant message over title. */
function feedCopy(input: {
  who: string;
  isOutgoing: boolean;
  title: string;
  message: string;
  emoji: string;
}): { headline: string; detail: string } {
  const title = input.title.trim();
  const message = input.message.trim();
  const body =
    message && message.toLowerCase() !== title.toLowerCase()
      ? message
      : `${input.emoji} ${title}`;

  if (input.isOutgoing) {
    return {
      headline: `You sent ${input.emoji} ${title}`,
      detail: body,
    };
  }

  const softOpeners = [
    'sent you a soft feeling',
    'dropped this for you',
    'wanted you to feel this',
    'thought of you',
  ];
  const pick =
    softOpeners[Math.abs(title.length + input.who.length) % softOpeners.length];

  return {
    headline: `${input.who} ${pick}`,
    detail: body.startsWith(input.emoji) ? body : `${input.emoji} ${body}`,
  };
}

export function ActivityItem({
  item,
  selfUserId,
  peerName,
  unread = false,
  onPress,
}: ActivityItemProps) {
  const isOutgoing = selfUserId != null && item.fromUserId === selfUserId;
  const who = isOutgoing ? 'You' : peerName?.trim() || 'Someone';
  const { headline, detail } = feedCopy({
    who,
    isOutgoing,
    title: item.title || 'Feeling',
    message: item.message || '',
    emoji: item.emoji || '💕',
  });

  const content = (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${headline}. ${detail}. ${formatActivityTime(item.createdAt)}`}
      style={[
        styles.card,
        unread ? styles.unread : styles.read,
        isOutgoing && !unread ? styles.outgoing : null,
      ]}
    >
      {unread ? <View style={styles.unreadBar} /> : null}
      <View style={[styles.emojiWrap, unread && styles.emojiWrapUnread]}>
        <Text style={styles.emoji}>{item.emoji || '💫'}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.headline} numberOfLines={2}>
            {headline}
          </Text>
          {unread ? <View style={styles.dot} /> : null}
        </View>
        <Text style={styles.detail} numberOfLines={2}>
          {detail}
        </Text>
        <Text style={styles.time}>{formatActivityTime(item.createdAt)}</Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.xl,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  unread: {
    backgroundColor: '#FFE4EC',
    borderColor: Colors.roseLight,
  },
  read: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    opacity: 0.92,
  },
  outgoing: {
    backgroundColor: Colors.cream,
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.rose,
  },
  emojiWrap: {
    width: 52,
    height: 52,
    borderRadius: Radii.lg,
    backgroundColor: Colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiWrapUnread: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  emoji: {
    fontSize: 28,
  },
  body: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  headline: {
    ...Typography.bodyStrong,
    color: Colors.ink,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.rose,
    marginTop: 5,
  },
  detail: {
    ...Typography.body,
    color: Colors.roseDark,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  time: {
    ...Typography.caption,
    color: Colors.inkSubtle,
    marginTop: 2,
  },
});
