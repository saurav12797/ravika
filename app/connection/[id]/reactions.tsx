import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, ErrorState, LoadingState } from '@/components/ui';
import { ConnectionSubnav } from '@/components/ConnectionSubnav';
import { EmojiPicker } from '@/components/EmojiPicker';
import { ReactionButton } from '@/components/ReactionButton';
import { useConnectionDetail } from '@/hooks/useConnectionDetail';
import {
  SENDABLE_REACTIONS,
  type ReactionDefinition,
} from '@/constants/reactions';
import { sendReaction } from '@/services/interactionService';
import { upsertFeelingOverride } from '@/services/sharedFeelingService';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import { toUserMessage } from '@/utils/errors';

type EditTarget = {
  id: ReactionDefinition['id'];
  emoji: string;
  title: string;
  subtitle: string;
};

export default function ConnectionReactionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { connection, peer, peerId, loading, error, reload } =
    useConnectionDetail(id);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [pickEmoji, setPickEmoji] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  const peerName = peer?.displayName ?? peer?.username ?? 'them';
  const overrides = connection?.feelingOverrides;

  const catalog = useMemo(() => {
    return SENDABLE_REACTIONS.map((r) => {
      const o = overrides?.[String(r.id)];
      return {
        ...r,
        emoji: o?.emoji?.trim() || r.emoji,
        title: o?.title?.trim() || r.title,
        defaultMessage:
          o?.subtitle?.trim() || o?.title?.trim() || r.defaultMessage,
      } as ReactionDefinition;
    });
  }, [overrides]);

  const onSend = useCallback(
    async (reaction: ReactionDefinition) => {
      if (!id || !peerId) {
        throw new Error('Missing connection');
      }
      await sendReaction({
        connectionId: id,
        toUserId: peerId,
        reactionType: reaction.id,
        emoji: reaction.emoji,
        title: reaction.title,
        message: reaction.defaultMessage,
        toDisplayName: peerName,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [id, peerId, peerName],
  );

  const openEdit = (reaction: ReactionDefinition) => {
    setEditTarget({
      id: reaction.id,
      emoji: reaction.emoji,
      title: reaction.title,
      subtitle: reaction.defaultMessage,
    });
    setPickEmoji(true);
  };

  const saveEdit = async () => {
    if (!id || !editTarget) return;
    const title = editTarget.title.trim();
    if (title.length < 2) {
      Alert.alert('Title needed', 'Give this feeling a short title.');
      return;
    }
    setEditBusy(true);
    try {
      await upsertFeelingOverride({
        connectionId: id,
        reactionId: editTarget.id,
        emoji: editTarget.emoji,
        title,
        subtitle: editTarget.subtitle.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditTarget(null);
      reload();
    } catch (err) {
      Alert.alert('Could not save', toUserMessage(err));
    } finally {
      setEditBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error || !id) return <ErrorState error={error} onRetry={reload} />;

  return (
    <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
      <ConnectionSubnav connectionId={id} />
      <Text style={styles.heading}>
        Tell {peer?.displayName?.split(' ')[0] ?? 'them'}
      </Text>
      <Text style={styles.sub}>
        Tap to send · long-press any feeling to customize emoji, title &
        description for this chat
      </Text>

      <FlatList
        data={catalog}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ReactionButton
              reaction={item}
              onPress={onSend}
              onLongPress={() => openEdit(item)}
              style={styles.btn}
            />
            <Pressable
              onPress={() => openEdit(item)}
              hitSlop={6}
              style={styles.editHint}
              accessibilityRole="button"
              accessibilityLabel={`Customize ${item.title}`}
            >
              <Text style={styles.editHintText}>Edit</Text>
            </Pressable>
          </View>
        )}
      />

      <Modal
        visible={editTarget != null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditTarget(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setEditTarget(null)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Customize feeling</Text>
            <Text style={styles.modalHint}>
              Changes apply only in this chat — Tap to send updates for both of
              you.
            </Text>

            <Text style={styles.fieldLabel}>1. Emoji</Text>
            <Pressable
              onPress={() => setPickEmoji((v) => !v)}
              style={styles.emojiPickRow}
            >
              <Text style={styles.emojiBig}>{editTarget?.emoji}</Text>
              <Text style={styles.emojiPickLabel}>
                {pickEmoji ? 'Hide picker' : 'Change emoji'}
              </Text>
            </Pressable>
            {pickEmoji && editTarget ? (
              <EmojiPicker
                onPick={(e) =>
                  setEditTarget((prev) =>
                    prev ? { ...prev, emoji: e } : prev,
                  )
                }
              />
            ) : null}

            <Text style={styles.fieldLabel}>2. Title</Text>
            <TextInput
              value={editTarget?.title ?? ''}
              onChangeText={(t) =>
                setEditTarget((prev) =>
                  prev ? { ...prev, title: t } : prev,
                )
              }
              placeholder="Short title"
              placeholderTextColor={Colors.inkSubtle}
              maxLength={40}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>3. Description</Text>
            <TextInput
              value={editTarget?.subtitle ?? ''}
              onChangeText={(t) =>
                setEditTarget((prev) =>
                  prev ? { ...prev, subtitle: t } : prev,
                )
              }
              placeholder="Message / soft description"
              placeholderTextColor={Colors.inkSubtle}
              maxLength={80}
              multiline
              style={[styles.input, styles.descInput]}
              textAlignVertical="top"
            />

            <Button
              title={editBusy ? 'Saving…' : 'Save'}
              loading={editBusy}
              onPress={() => void saveEdit()}
              fullWidth
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setEditTarget(null)}
              fullWidth
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  heading: {
    ...Typography.title,
    color: Colors.ink,
    paddingHorizontal: Spacing.xl,
  },
  sub: {
    ...Typography.caption,
    color: Colors.inkMuted,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  grid: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
    gap: Spacing.md,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  btn: {
    alignItems: 'center',
  },
  editHint: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  editHintText: {
    ...Typography.caption,
    color: Colors.rose,
    fontWeight: '700',
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii['2xl'],
    borderTopRightRadius: Radii['2xl'],
    padding: Spacing['2xl'],
    gap: Spacing.md,
    maxHeight: '90%',
  },
  modalTitle: {
    ...Typography.heading,
    color: Colors.ink,
  },
  modalHint: {
    ...Typography.caption,
    color: Colors.inkMuted,
    marginTop: -4,
  },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.inkMuted,
    fontWeight: '600',
  },
  emojiPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emojiBig: { fontSize: 40 },
  emojiPickLabel: {
    ...Typography.label,
    color: Colors.roseDark,
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
  descInput: {
    minHeight: 72,
  },
});
