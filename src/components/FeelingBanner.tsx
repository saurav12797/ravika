import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';

type Props = {
  emoji: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  busy?: boolean;
  /** Live preview while creating (not tappable send). */
  preview?: boolean;
};

/**
 * Distinct banner card for custom shared feelings (not a round emoji chip).
 */
export function FeelingBanner({
  emoji,
  title,
  subtitle,
  onPress,
  busy,
  preview,
}: Props) {
  const body = (
    <LinearGradient
      colors={['#FFE8F0', '#FFF6EE', '#FFE4EC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.banner, preview && styles.preview, busy && styles.busy]}
    >
      <View style={styles.emojiBox}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.badge}>YOURS</Text>
        <Text style={styles.title} numberOfLines={1}>
          {title || 'Heading'}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle || 'Subheading'}
        </Text>
      </View>
    </LinearGradient>
  );

  if (!onPress || preview) {
    return body;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Send ${title}`}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radii.xl,
    borderWidth: 1.5,
    borderColor: Colors.roseLight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  preview: {
    borderStyle: 'dashed',
  },
  busy: { opacity: 0.65 },
  emojiBox: {
    width: 56,
    height: 56,
    borderRadius: Radii.lg,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  emoji: { fontSize: 30 },
  text: { flex: 1, gap: 2, minWidth: 0 },
  badge: {
    ...Typography.overline,
    color: Colors.rose,
    letterSpacing: 1.2,
    fontSize: 9,
  },
  title: {
    ...Typography.bodyStrong,
    color: Colors.ink,
    fontSize: 16,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.inkMuted,
    fontSize: 13,
    lineHeight: 17,
  },
});
