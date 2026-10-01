import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { EmojiPicker } from '@/components/EmojiPicker';
import { FeelingBanner } from '@/components/FeelingBanner';
import { ReactionButton } from '@/components/ReactionButton';
import {
  buildOneTapFeelings,
  getShortReactionLabel,
  SENDABLE_REACTIONS,
  type OneTapFeeling,
  type ReactionDefinition,
} from '@/constants/reactions';
import { sendReaction, getSentFeelingBreakdown } from '@/services/interactionService';
import { addSharedFeeling } from '@/services/sharedFeelingService';
import {
  EMPTY_FEELING_USAGE,
  useConnectionFeelingUsageStore,
} from '@/stores/connectionFeelingUsageStore';
import { useSentCountsStore } from '@/stores/sentCountsStore';
import { useAuthStore } from '@/stores/authStore';
import { useConnections } from '@/hooks/useConnections';
import { pickFeelingMessage } from '@/utils/feelingMessages';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import { toUserMessage } from '@/utils/errors';

type SheetMode = 'pick' | 'write' | 'createBanner' | 'customEmoji';

type Props = {
  visible: boolean;
  connectionId: string;
  toUserId: string;
  peerName: string;
  onClose: () => void;
  /** Open directly on the custom-message composer. */
  startOnCustom?: boolean;
};

/** Bottom sheet: Tap to send, Custom emotion (save), or Send Message. */
export function QuickFeelSheet({
  visible,
  connectionId,
  toUserId,
  peerName,
  onClose,
  startOnCustom = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { withPeers, refreshPeers } = useConnections();
  const userId = useAuthStore((s) => s.user?.uid);
  const hydrateUsage = useConnectionFeelingUsageStore((s) => s.hydrate);
  const hydrateSent = useSentCountsStore((s) => s.hydrate);
  const mergeRemoteSent = useSentCountsStore((s) => s.mergeRemote);
  const overallFrequency = useSentCountsStore((s) => s.byReaction);
  const selectUsage = useCallback(
    (s: { byConnection: Record<string, { items: typeof EMPTY_FEELING_USAGE }> }) =>
      s.byConnection[connectionId]?.items ?? EMPTY_FEELING_USAGE,
    [connectionId],
  );
  const usageItems = useConnectionFeelingUsageStore(selectUsage);
  const connection = useMemo(
    () => withPeers.find((p) => p.connection.id === connectionId)?.connection,
    [withPeers, connectionId],
  );
  const feelingOverrides = connection?.feelingOverrides;
  const allConnectionIds = useMemo(
    () => withPeers.map((p) => p.connection.id),
    [withPeers],
  );

  const [mode, setMode] = useState<SheetMode>(startOnCustom ? 'write' : 'pick');
  const [customText, setCustomText] = useState('');
  const [customEmoji, setCustomEmoji] = useState('💌');
  const [showInsertPicker, setShowInsertPicker] = useState(false);
  const [emojiPairMessage, setEmojiPairMessage] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const [bannerEmoji, setBannerEmoji] = useState('💕');
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerPickEmoji, setBannerPickEmoji] = useState(true);
  const [orderVisit, setOrderVisit] = useState(0);
  const frozenKeysRef = useRef<string[] | null>(null);

  const firstName = useMemo(
    () => peerName.split(' ')[0] || peerName || 'them',
    [peerName],
  );

  useEffect(() => {
    if (!visible) return;
    void hydrateUsage(connectionId, { force: true });
    void hydrateSent();
  }, [hydrateUsage, hydrateSent, connectionId, visible]);

  // Sync overall frequency from server so Tap to send matches all-time sends.
  useEffect(() => {
    if (!visible || !userId || allConnectionIds.length === 0) return;
    let cancelled = false;
    void getSentFeelingBreakdown(allConnectionIds, userId).then((b) => {
      if (cancelled || b.total <= 0) return;
      mergeRemoteSent(b.byReaction, b.total);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, userId, allConnectionIds, mergeRemoteSent]);

  useEffect(() => {
    if (visible) {
      setMode(startOnCustom ? 'write' : 'pick');
      setCustomText('');
      setCustomEmoji('💌');
      setShowInsertPicker(false);
      setEmojiPairMessage('');
      setSearch('');
      setBannerEmoji('💕');
      setBannerTitle('');
      setBannerSubtitle('');
      setBannerPickEmoji(true);
      setBusy(false);
      // Fresh order snapshot each time the sheet opens.
      frozenKeysRef.current = null;
      setOrderVisit((v) => v + 1);
    }
  }, [visible, startOnCustom]);

  const liveOrdered = useMemo(
    () =>
      buildOneTapFeelings({
        includeShared: false,
        usage: usageItems,
        frequency: overallFrequency,
        overrides: feelingOverrides,
        limit: SENDABLE_REACTIONS.length,
      }),
    [usageItems, overallFrequency, feelingOverrides],
  );

  const ordered = useMemo(() => {
    if (!frozenKeysRef.current) {
      frozenKeysRef.current = liveOrdered.map((f) => f.usageKey);
      return liveOrdered;
    }
    const byKey = new Map(liveOrdered.map((f) => [f.usageKey, f]));
    const next: OneTapFeeling[] = [];
    for (const key of frozenKeysRef.current) {
      const item = byKey.get(key);
      if (item) next.push(item);
    }
    for (const item of liveOrdered) {
      if (!frozenKeysRef.current.includes(item.usageKey)) next.push(item);
    }
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveOrdered, orderVisit]);

  const gridItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.defaultMessage.toLowerCase().includes(q) ||
        r.emoji.includes(q) ||
        getShortReactionLabel(r.id).toLowerCase().includes(q),
    );
  }, [ordered, search]);

  const onSendFeeling = useCallback(
    async (feeling: OneTapFeeling) => {
      if (busy) return;
      setBusy(true);
      try {
        await sendReaction({
          connectionId,
          toUserId,
          reactionType: feeling.id,
          customReactionId: feeling.customFeelingId,
          emoji: feeling.emoji,
          title: feeling.title,
          message: feeling.customFeelingId
            ? feeling.defaultMessage
            : pickFeelingMessage(feeling),
          toDisplayName: peerName,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } finally {
        setBusy(false);
      }
    },
    [busy, connectionId, toUserId, peerName],
  );

  /** Save custom emotion → appears under Tap to send (no auto-send). */
  const createBanner = async () => {
    const title = bannerTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await addSharedFeeling({
        connectionId,
        emoji: bannerEmoji,
        title,
        subtitle: bannerSubtitle.trim() || undefined,
      });
      refreshPeers();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode('pick');
      setBannerTitle('');
      setBannerSubtitle('');
      setBannerEmoji('💕');
    } catch (err) {
      Alert.alert('Could not save', toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sendCustom = async () => {
    const message = customText.trim();
    if (!message || busy) return;
    setBusy(true);
    try {
      await sendReaction({
        connectionId,
        toUserId,
        reactionType: 'custom_text',
        message,
        emoji: '💌',
        title: message.slice(0, 40) || 'A note for you',
        toDisplayName: peerName,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (err) {
      Alert.alert('Could not send', toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** One emoji + one short message — no long note field. */
  const sendEmojiPair = async () => {
    const message = emojiPairMessage.trim();
    if (!message || busy) return;
    setBusy(true);
    try {
      await sendReaction({
        connectionId,
        toUserId,
        reactionType: 'custom_text',
        message,
        emoji: customEmoji,
        title: message.slice(0, 40),
        toDisplayName: peerName,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (err) {
      Alert.alert('Could not send', toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setCustomText((prev) => `${prev}${emoji}`);
  };

  const headerTitle =
    mode === 'write'
      ? `Message ${firstName}`
      : mode === 'createBanner'
        ? 'Custom emotion'
        : mode === 'customEmoji'
          ? 'Custom emoji'
          : `Tell ${firstName}`;
  const headerSub =
    mode === 'write'
      ? 'Write a note — emoji at the bottom left'
      : mode === 'createBanner'
        ? 'Emoji + title + description — saved under Tap to send'
        : mode === 'customEmoji'
          ? 'Pick 1 emoji and 1 short message'
          : 'Most sent overall on top — tap to send';

  const sheetHeight = Math.round(Dimensions.get('window').height * 0.9);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              maxHeight: sheetHeight,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{headerTitle}</Text>
              <Text style={styles.sub}>{headerSub}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.xBtn}
            >
              <Text style={styles.xText}>✕</Text>
            </Pressable>
          </View>

          {mode === 'createBanner' ? (
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={styles.bannerCreate}>
                <FeelingBanner
                  emoji={bannerEmoji}
                  title={bannerTitle || 'Title'}
                  subtitle={bannerSubtitle || 'Description'}
                  preview
                />

                <Text style={styles.fieldLabel}>1. Emoji</Text>
                <Pressable
                  onPress={() => setBannerPickEmoji((v) => !v)}
                  style={styles.emojiPickRow}
                >
                  <Text style={styles.emojiPickBig}>{bannerEmoji}</Text>
                  <Text style={styles.emojiPickLabel}>
                    {bannerPickEmoji ? 'Hide picker' : 'Tap to change emoji'}
                  </Text>
                </Pressable>
                {bannerPickEmoji ? (
                  <EmojiPicker onPick={(e) => setBannerEmoji(e)} />
                ) : null}

                <Text style={styles.fieldLabel}>2. Title</Text>
                <TextInput
                  value={bannerTitle}
                  onChangeText={setBannerTitle}
                  placeholder="e.g. Miss you yaar"
                  placeholderTextColor={Colors.inkSubtle}
                  maxLength={40}
                  style={styles.input}
                />

                <Text style={styles.fieldLabel}>3. Description</Text>
                <TextInput
                  value={bannerSubtitle}
                  onChangeText={setBannerSubtitle}
                  placeholder="Soft line under the title"
                  placeholderTextColor={Colors.inkSubtle}
                  maxLength={80}
                  style={[styles.input, styles.descInput]}
                  multiline
                  textAlignVertical="top"
                />

                <View style={styles.customActions}>
                  <Pressable onPress={() => setMode('pick')} style={styles.secondaryBtn}>
                    <Text style={styles.secondaryText}>Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void createBanner()}
                    disabled={busy || bannerTitle.trim().length < 2}
                    style={[
                      styles.primaryBtn,
                      (busy || bannerTitle.trim().length < 2) && styles.primaryDisabled,
                    ]}
                  >
                    <Text style={styles.primaryText}>
                      {busy ? 'Saving…' : 'Save to Tap to send'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          ) : mode === 'customEmoji' ? (
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={styles.customBox}>
                <Text style={styles.fieldLabel}>1. Emoji</Text>
                <View style={styles.pairEmojiRow}>
                  <Text style={styles.pairEmojiBig}>{customEmoji}</Text>
                  <Text style={styles.pairEmojiHint}>Tap below to choose</Text>
                </View>
                <EmojiPicker onPick={(e) => setCustomEmoji(e)} />

                <Text style={styles.fieldLabel}>2. Message</Text>
                <TextInput
                  value={emojiPairMessage}
                  onChangeText={setEmojiPairMessage}
                  placeholder={`One short line for ${firstName}…`}
                  placeholderTextColor={Colors.inkSubtle}
                  maxLength={80}
                  style={styles.input}
                  autoFocus
                />

                <View style={styles.customActions}>
                  <Pressable
                    onPress={() => {
                      setMode('write');
                      setEmojiPairMessage('');
                    }}
                    style={styles.secondaryBtn}
                  >
                    <Text style={styles.secondaryText}>Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void sendEmojiPair()}
                    disabled={busy || !emojiPairMessage.trim()}
                    style={[
                      styles.primaryBtn,
                      (!emojiPairMessage.trim() || busy) && styles.primaryDisabled,
                    ]}
                  >
                    <Text style={styles.primaryText}>{busy ? 'Sending…' : 'Send'}</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          ) : mode === 'write' ? (
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={styles.customBox}>
                <View style={styles.composer}>
                  <TextInput
                    value={customText}
                    onChangeText={setCustomText}
                    placeholder={`Write anything for ${firstName}…`}
                    placeholderTextColor={Colors.inkSubtle}
                    multiline
                    maxLength={280}
                    style={[styles.longInput, styles.noOutline]}
                    autoFocus
                    textAlignVertical="top"
                  />
                  <View style={styles.composerFooter}>
                    <Pressable
                      onPress={() => setShowInsertPicker((v) => !v)}
                      style={[styles.inBoxEmoji, showInsertPicker && styles.inBoxEmojiOn]}
                      accessibilityRole="button"
                      accessibilityLabel="Insert emoji into note"
                    >
                      <Text style={styles.inBoxEmojiText}>☺</Text>
                    </Pressable>
                  </View>
                </View>

                {showInsertPicker ? (
                  <View style={styles.emojiTray}>
                    <EmojiPicker onPick={(e) => insertEmoji(e)} />
                  </View>
                ) : null}

                <Pressable
                  onPress={() => {
                    setShowInsertPicker(false);
                    setMode('customEmoji');
                  }}
                  style={styles.optionRow}
                  accessibilityRole="button"
                >
                  <Text style={styles.optionEmoji}>{customEmoji}</Text>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>Set Custom emoji</Text>
                    <Text style={styles.optionSub}>
                      Pick 1 emoji + 1 message — replaces the note above
                    </Text>
                  </View>
                  <Text style={styles.optionChevron}>›</Text>
                </Pressable>

                <View style={styles.customActions}>
                  <Pressable
                    onPress={() => {
                      if (startOnCustom) {
                        onClose();
                      } else {
                        setMode('pick');
                        setShowInsertPicker(false);
                      }
                    }}
                    style={styles.secondaryBtn}
                  >
                    <Text style={styles.secondaryText}>
                      {startOnCustom ? 'Close' : 'Back'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void sendCustom()}
                    disabled={busy || !customText.trim()}
                    style={[
                      styles.primaryBtn,
                      (!customText.trim() || busy) && styles.primaryDisabled,
                    ]}
                  >
                    <Text style={styles.primaryText}>
                      {busy ? 'Sending…' : 'Send feeling'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.listWrap}>
              <View style={styles.topActions}>
                <Pressable
                  onPress={() => setMode('createBanner')}
                  style={styles.topAction}
                >
                  <Text style={styles.topActionEmoji}>✨</Text>
                  <Text style={styles.topActionText}>Custom emotion</Text>
                </Pressable>
                <Pressable onPress={() => setMode('write')} style={styles.topAction}>
                  <Text style={styles.topActionEmoji}>✍️</Text>
                  <Text style={styles.topActionText}>Send Message</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>Tap to send</Text>

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search feelings…"
                placeholderTextColor={Colors.inkSubtle}
                style={styles.search}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />

              <FlatList
                data={gridItems}
                keyExtractor={(item) => item.usageKey}
                numColumns={3}
                scrollEnabled
                keyboardShouldPersistTaps="handled"
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.grid}
                style={styles.list}
                ListEmptyComponent={
                  <Text style={styles.emptySearch}>
                    No feelings match “{search.trim()}”
                  </Text>
                }
                renderItem={({ item }) => (
                  <ReactionButton
                    reaction={item as ReactionDefinition}
                    size="md"
                    disabled={busy}
                    label={
                      item.customFeelingId
                        ? item.title
                        : feelingOverrides?.[String(item.id)]?.title ||
                          getShortReactionLabel(item.id)
                    }
                    onPress={async () => {
                      try {
                        await onSendFeeling(item);
                        onClose();
                      } catch (err) {
                        Alert.alert('Could not send', toUserMessage(err));
                        throw err;
                      }
                    }}
                  />
                )}
              />
            </View>
          )}
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
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  titleBlock: { flex: 1, gap: 2 },
  title: { ...Typography.heading, color: Colors.ink },
  sub: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  xBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xText: {
    ...Typography.label,
    color: Colors.roseDark,
    fontSize: 16,
  },
  listWrap: { flex: 1, minHeight: 0 },
  formScroll: { flex: 1, minHeight: 0 },
  formContent: { paddingBottom: Spacing.lg, gap: Spacing.sm },
  topActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  topAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.cream,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.roseLight,
    paddingVertical: Spacing.md,
  },
  topActionEmoji: { fontSize: 16 },
  topActionText: {
    ...Typography.label,
    color: Colors.roseDark,
    fontWeight: '700',
  },
  sectionLabel: {
    ...Typography.overline,
    color: Colors.rose,
    marginBottom: Spacing.sm,
  },
  bannerCreate: { gap: Spacing.md, marginBottom: Spacing.md },
  emojiPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emojiPickBig: { fontSize: 40 },
  emojiPickLabel: {
    ...Typography.label,
    color: Colors.roseDark,
  },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.inkMuted,
    fontWeight: '600',
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
  search: {
    borderWidth: 1.5,
    borderColor: Colors.roseLight,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    color: Colors.ink,
    backgroundColor: Colors.cream,
    marginBottom: Spacing.md,
  },
  list: { flexGrow: 0, flexShrink: 1 },
  grid: { gap: Spacing.md, paddingBottom: Spacing.xl },
  row: { justifyContent: 'space-between', marginBottom: Spacing.md, gap: Spacing.sm },
  emptySearch: {
    ...Typography.body,
    color: Colors.inkMuted,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  customBox: { gap: Spacing.md, marginBottom: Spacing.md },
  composer: {
    borderWidth: 1.5,
    borderColor: Colors.roseLight,
    borderRadius: Radii.lg,
    backgroundColor: Colors.cream,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    minHeight: 168,
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Spacing.xs,
  },
  inBoxEmoji: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inBoxEmojiOn: {
    backgroundColor: Colors.blush,
  },
  inBoxEmojiText: {
    fontSize: 22,
    color: Colors.inkMuted,
  },
  longInput: {
    minHeight: 112,
    maxHeight: 200,
    ...Typography.body,
    color: Colors.ink,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  // RN Web focus ring
  noOutline: {
    outlineWidth: 0,
  },

  pairEmojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  pairEmojiBig: { fontSize: 44 },
  pairEmojiHint: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  emojiTray: {
    borderRadius: Radii.lg,
    overflow: 'hidden',
    gap: Spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  optionEmoji: { fontSize: 28 },
  optionTextWrap: { flex: 1, gap: 2 },
  optionTitle: {
    ...Typography.label,
    color: Colors.ink,
    fontWeight: '700',
  },
  optionSub: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  optionChevron: {
    ...Typography.label,
    color: Colors.roseDark,
    fontSize: 18,
  },
  customActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  secondaryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  secondaryText: { ...Typography.label, color: Colors.inkMuted },
  primaryBtn: {
    backgroundColor: Colors.rose,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { ...Typography.label, color: Colors.white, fontWeight: '700' },
});
