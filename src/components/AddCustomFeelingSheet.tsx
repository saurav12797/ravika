import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmojiPicker } from '@/components/EmojiPicker';
import { FeelingBanner } from '@/components/FeelingBanner';
import { addSharedFeeling } from '@/services/sharedFeelingService';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type { SharedFeeling } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

type Props = {
  visible: boolean;
  connectionId: string;
  peerName: string;
  onClose: () => void;
  onSaved: (feeling: SharedFeeling) => void;
};

/**
 * Create a custom banner: 1 emoji + heading + subheading, shared forever.
 */
export function AddCustomFeelingSheet({
  visible,
  connectionId,
  peerName,
  onClose,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets();
  const [emoji, setEmoji] = useState('💕');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [showEmojis, setShowEmojis] = useState(true);

  useEffect(() => {
    if (visible) {
      setEmoji('💕');
      setTitle('');
      setSubtitle('');
      setShowEmojis(true);
      setBusy(false);
    }
  }, [visible]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const feeling = await addSharedFeeling({
        connectionId,
        emoji,
        title,
        subtitle: subtitle.trim() || undefined,
      });
      onSaved(feeling);
      onClose();
    } catch (err) {
      Alert.alert('Could not save', toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const first = peerName.split(' ')[0] || 'them';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>New banner</Text>
              <Text style={styles.sub}>
                1 emoji · heading · subheading — saved for you and {first}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.xBtn}>
              <Text style={styles.xText}>✕</Text>
            </Pressable>
          </View>

          <FeelingBanner
            emoji={emoji}
            title={title}
            subtitle={subtitle}
            preview
          />

          <Pressable
            onPress={() => setShowEmojis((v) => !v)}
            style={styles.emojiToggle}
          >
            <Text style={styles.previewEmoji}>{emoji}</Text>
            <Text style={styles.emojiToggleText}>
              {showEmojis ? 'Hide emojis' : 'Change emoji'}
            </Text>
          </Pressable>

          {showEmojis ? (
            <EmojiPicker
              onPick={(e) => {
                setEmoji(e);
              }}
            />
          ) : null}

          <Text style={styles.fieldLabel}>Heading</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Soft goodnight"
            placeholderTextColor={Colors.inkSubtle}
            maxLength={40}
            style={styles.input}
            autoFocus={!showEmojis}
          />

          <Text style={styles.fieldLabel}>Subheading</Text>
          <TextInput
            value={subtitle}
            onChangeText={setSubtitle}
            placeholder="e.g. Sleep well, I’m thinking of you"
            placeholderTextColor={Colors.inkSubtle}
            maxLength={60}
            style={styles.input}
          />

          <Pressable
            onPress={() => void save()}
            disabled={busy || title.trim().length < 2}
            style={[
              styles.saveBtn,
              (busy || title.trim().length < 2) && styles.saveDisabled,
            ]}
          >
            <Text style={styles.saveText}>
              {busy ? 'Saving…' : `Save banner for both of you`}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(40, 20, 30, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii['2xl'],
    borderTopRightRadius: Radii['2xl'],
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  titleBlock: { flex: 1, gap: 2 },
  title: { ...Typography.heading, color: Colors.ink },
  sub: { ...Typography.caption, color: Colors.inkMuted },
  xBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xText: { ...Typography.label, color: Colors.roseDark, fontSize: 16 },
  emojiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.lg,
    backgroundColor: Colors.blush,
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  previewEmoji: { fontSize: 32 },
  emojiToggleText: { ...Typography.label, color: Colors.roseDark },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.inkMuted,
    fontWeight: '600',
    marginBottom: -8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.roseLight,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    color: Colors.ink,
    backgroundColor: Colors.cream,
  },
  saveBtn: {
    backgroundColor: Colors.rose,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.5 },
  saveText: {
    ...Typography.label,
    color: Colors.white,
    fontWeight: '700',
  },
});
