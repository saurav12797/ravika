import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';

const EMOJI_CATEGORIES: Array<{ id: string; label: string; emojis: string[] }> =
  [
    {
      id: 'smileys',
      label: '😊',
      emojis: [
        '😀',
        '😃',
        '😄',
        '😁',
        '😆',
        '😅',
        '😂',
        '🤣',
        '😊',
        '😇',
        '🙂',
        '🙃',
        '😉',
        '😌',
        '😍',
        '🥰',
        '😘',
        '😗',
        '😙',
        '😚',
        '😋',
        '😛',
        '😝',
        '😜',
        '🤪',
        '🤨',
        '🧐',
        '🤓',
        '😎',
        '🤩',
        '🥳',
        '😏',
        '😒',
        '😞',
        '😔',
        '😟',
        '😕',
        '🙁',
        '☹️',
        '😣',
        '😖',
        '😫',
        '😩',
        '🥺',
        '😢',
        '😭',
        '😤',
        '😠',
        '😡',
        '🤬',
        '🤯',
        '😳',
        '🥵',
        '🥶',
        '😱',
        '😨',
        '😰',
        '😥',
        '😓',
        '🤗',
        '🤔',
        '🤭',
        '🤫',
        '🤥',
        '😶',
        '😐',
        '😑',
        '😬',
        '🙄',
        '😯',
        '😦',
        '😧',
        '😮',
        '😲',
        '🥱',
        '😴',
        '🤤',
        '😪',
        '😵',
        '🤐',
        '🥴',
        '🤢',
        '🤮',
        '🤧',
        '😷',
        '🤒',
        '🤕',
      ],
    },
    {
      id: 'hearts',
      label: '❤️',
      emojis: [
        '❤️',
        '🧡',
        '💛',
        '💚',
        '💙',
        '💜',
        '🖤',
        '🤍',
        '🤎',
        '💕',
        '💞',
        '💓',
        '💗',
        '💖',
        '💘',
        '💝',
        '💟',
        '❣️',
        '💔',
        '❤️‍🔥',
        '❤️‍🩹',
        '💋',
        '💌',
        '💐',
        '🌹',
        '🥀',
        '🌺',
        '🌸',
        '🌼',
        '🌻',
      ],
    },
    {
      id: 'gestures',
      label: '👋',
      emojis: [
        '👋',
        '🤚',
        '🖐️',
        '✋',
        '🖖',
        '👌',
        '🤌',
        '🤏',
        '✌️',
        '🤞',
        '🤟',
        '🤘',
        '🤙',
        '👈',
        '👉',
        '👆',
        '🖕',
        '👇',
        '☝️',
        '👍',
        '👎',
        '✊',
        '👊',
        '🤛',
        '🤜',
        '👏',
        '🙌',
        '👐',
        '🤲',
        '🤝',
        '🙏',
        '✍️',
        '💅',
        '🤳',
        '💪',
        '🦾',
        '🦿',
        '🦵',
        '🦶',
        '👂',
        '🦻',
        '👃',
        '🧠',
        '👀',
        '👁️',
        '👅',
        '👄',
        '🫂',
      ],
    },
    {
      id: 'fun',
      label: '✨',
      emojis: [
        '✨',
        '⭐',
        '🌟',
        '💫',
        '🔥',
        '💥',
        '💢',
        '💦',
        '💨',
        '🎉',
        '🎊',
        '🎈',
        '🎁',
        '🏆',
        '🥇',
        '🎯',
        '🎮',
        '🎵',
        '🎶',
        '☕',
        '🍕',
        '🍦',
        '🍰',
        '🍫',
        '🍿',
        '🧃',
        '🌙',
        '☀️',
        '🌤️',
        '🌈',
        '☁️',
        '⚡',
        '❄️',
        '🌸',
        '🍀',
        '🐱',
        '🐶',
        '🐻',
        '🐼',
        '🦊',
        '🐰',
        '🦋',
        '🐝',
      ],
    },
  ];

type Props = {
  onPick: (emoji: string) => void;
};

/**
 * WhatsApp-style emoji tray for custom feelings (works on web + native).
 */
export function EmojiPicker({ onPick }: Props) {
  const [categoryId, setCategoryId] = useState(EMOJI_CATEGORIES[0].id);
  const category = useMemo(
    () =>
      EMOJI_CATEGORIES.find((c) => c.id === categoryId) ?? EMOJI_CATEGORIES[0],
    [categoryId],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs}>
        {EMOJI_CATEGORIES.map((c) => {
          const on = c.id === categoryId;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              style={[styles.tab, on && styles.tabOn]}
              accessibilityRole="button"
              accessibilityLabel={`Emoji category ${c.id}`}
            >
              <Text style={styles.tabEmoji}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {category.emojis.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => onPick(emoji)}
            style={styles.cell}
            accessibilityRole="button"
            accessibilityLabel={`Insert ${emoji}`}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    backgroundColor: Colors.cream,
    overflow: 'hidden',
    maxHeight: 220,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.blush,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  tabOn: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.rose,
  },
  tabEmoji: { fontSize: 20 },
  scroll: { maxHeight: 168 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.sm,
    gap: 2,
  },
  cell: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
});
