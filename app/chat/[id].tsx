import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { EmojiPicker } from '@/components/EmojiPicker';
import { useConnections } from '@/hooks/useConnections';
import {
  markMessagesRead,
  sendChatMessage,
  subscribeToChatMessages,
} from '@/services/chatService';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Spacing, Typography } from '@/theme/colors';
import type { ChatMessage } from '@/types/models';
import { toUserMessage } from '@/utils/errors';
import { format } from 'date-fns';
import { derivePresenceStatus, describePresence } from '@/services/presenceService';

/**
 * WhatsApp-style ticks:
 * ✓ sent · ✓✓ delivered · blue ✓✓ read
 */
function Tick({
  status,
  peerOnline,
}: {
  status: ChatMessage['status'];
  peerOnline: boolean;
}) {
  if (status === 'read') {
    return (
      <Ionicons
        name="checkmark-done"
        size={17}
        color="#78D6A0"
        accessibilityLabel="Read"
      />
    );
  }
  if (status === 'delivered' || peerOnline) {
    return (
      <Ionicons
        name="checkmark-done"
        size={17}
        color="#667781"
        accessibilityLabel="Delivered"
      />
    );
  }
  return (
    <Ionicons name="checkmark" size={16} color="#667781" accessibilityLabel="Sent" />
  );
}

/**
 * 1:1 chat — WhatsApp bubbles (green sent / white received) + ticks.
 */
export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.uid);
  const { withPeers, loading: connectionsLoading } = useConnections();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const markedReadRef = useRef<Set<string>>(new Set());
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const windowHeight = Dimensions.get('window').height;
      const overlap = Math.max(0, windowHeight - event.endCoordinates.screenY);
      setKeyboardOverlap(overlap);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOverlap(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const peerEntry = useMemo(
    () => withPeers.find((p) => p.connection.id === id),
    [withPeers, id],
  );
  const peerName = peerEntry?.peer?.displayName || peerEntry?.peer?.username || 'Chat';
  const peerPresence = describePresence(peerEntry?.peer?.lastActiveAt);
  const peerStatus = derivePresenceStatus(peerEntry?.peer?.lastActiveAt);
  const toUserId = peerEntry?.connection.userIds.find((uid) => uid !== userId) ?? '';
  const userIds = peerEntry?.connection.userIds;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    markedReadRef.current = new Set();
    const unsub = subscribeToChatMessages(
      id,
      (items) => {
        setMessages(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id || !userId || messages.length === 0) return;
    const needRead = messages
      .filter(
        (m) =>
          m.fromUserId !== userId &&
          m.status !== 'read' &&
          !markedReadRef.current.has(m.id),
      )
      .map((m) => m.id);
    if (needRead.length === 0) return;
    for (const mid of needRead) markedReadRef.current.add(mid);
    void markMessagesRead(id, needRead).catch(() => {
      for (const mid of needRead) markedReadRef.current.delete(mid);
    });
  }, [id, userId, messages]);

  const send = useCallback(async () => {
    if (!id || !toUserId || !userId || !userIds || !text.trim()) {
      if (!toUserId || !userIds) {
        Alert.alert('Chat not ready', 'Open this chat again in a moment.');
      }
      return;
    }
    const body = text.trim();
    const tempId = `local-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      connectionId: id,
      fromUserId: userId,
      text: body,
      createdAt: Date.now(),
      status: 'sent',
    };
    setText('');
    setShowEmoji(false);
    setError(null);
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });

    try {
      const saved = await sendChatMessage({
        connectionId: id,
        toUserId,
        text: body,
        userIds: [userIds[0], userIds[1]] as [string, string],
      });
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.some((m) => m.id === saved.id)) return withoutTemp;
        return [...withoutTemp, saved];
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(body);
      const msg = toUserMessage(err);
      setError(err instanceof Error ? err : new Error(msg));
      Alert.alert('Could not send', msg);
    }
  }, [id, toUserId, userId, userIds, text]);

  if (!id) {
    return <ErrorState error={new Error('Missing chat')} onRetry={() => router.back()} />;
  }

  if (connectionsLoading && !peerEntry) {
    return <LoadingState label="Opening chat…" />;
  }

  const headerOffset = insets.top + 56;

  return (
    <View style={styles.flex}>
      <LinearGradient
        colors={['#FFF8F2', '#FFE8EE', '#FBE0E8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.wallpaperHearts}>
        <Text style={[styles.wallHeart, styles.wallHeartOne]}>♡</Text>
        <Text style={[styles.wallHeart, styles.wallHeartTwo]}>♡</Text>
        <Text style={[styles.wallHeart, styles.wallHeartThree]}>♥</Text>
        <Text style={[styles.wallHeart, styles.wallHeartFour]}>♡</Text>
      </View>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.headerContent}>
              <Avatar uri={peerEntry?.peer?.avatarUrl} name={peerName} size={38} />
              <View style={styles.headerTitle}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {peerName}
                </Text>
                <View style={styles.presenceLine}>
                  <View
                    style={[
                      styles.presenceDot,
                      peerStatus === 'online' && styles.presenceDotOnline,
                    ]}
                  />
                  <Text style={styles.headerPresence} numberOfLines={1}>
                    {peerPresence}
                  </Text>
                </View>
              </View>
            </View>
          ),
        }}
      />

      {error && messages.length === 0 ? (
        <ErrorState error={error} onRetry={() => setError(null)} />
      ) : loading && messages.length === 0 ? (
        <LoadingState label="Loading messages…" />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={styles.chatBg}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[
            styles.list,
            messages.length === 0 && styles.emptyPad,
            {
              paddingBottom: keyboardOverlap > 0 ? Spacing.lg : Spacing.md,
            },
          ]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState
              emoji="💬"
              title={`Say hi to ${peerName.split(' ')[0]}`}
              description="✓ sent · ✓✓ delivered · blue ✓✓ read"
            />
          }
          renderItem={({ item }) => {
            const mine = item.fromUserId === userId;
            return (
              <Animated.View
                entering={mine ? FadeInRight.duration(180) : FadeInLeft.duration(180)}
                style={[
                  styles.bubbleRow,
                  mine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
                ]}
              >
                {!mine ? <Avatar name={peerName} size={30} /> : null}
                <View
                  style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                >
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                    {item.text}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.time, mine && styles.timeMine]}>
                      {item.createdAt ? format(item.createdAt, 'h:mm a') : ''}
                    </Text>
                    {mine ? (
                      <Tick status={item.status} peerOnline={peerStatus === 'online'} />
                    ) : null}
                  </View>
                </View>
              </Animated.View>
            );
          }}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerOffset}
        style={Platform.OS === 'android' ? { marginBottom: keyboardOverlap } : undefined}
      >
        {showEmoji ? (
          <View style={styles.emojiTray}>
            <EmojiPicker
              onPick={(emoji) => {
                setText((prev) => `${prev}${emoji}`);
              }}
            />
          </View>
        ) : null}

        <View
          style={[
            styles.composer,
            {
              paddingBottom:
                keyboardOverlap > 0 ? Spacing.sm : Math.max(insets.bottom, Spacing.sm),
            },
          ]}
        >
          <View style={styles.inputShell}>
            <Pressable
              onPress={() => setShowEmoji((v) => !v)}
              style={styles.emojiBtn}
              accessibilityRole="button"
              accessibilityLabel="Emoji"
              hitSlop={8}
            >
              <Ionicons
                name={showEmoji ? 'happy' : 'happy-outline'}
                size={22}
                color={Colors.rose}
              />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={`Message ${peerName}`}
              placeholderTextColor={Colors.inkSubtle}
              style={styles.input}
              multiline
              maxLength={2000}
              onFocus={() => {
                setShowEmoji(false);
                requestAnimationFrame(() => {
                  listRef.current?.scrollToEnd({ animated: true });
                });
              }}
            />
          </View>
          <Pressable
            onPress={() => void send()}
            disabled={!text.trim()}
            style={[styles.sendBtn, !text.trim() && styles.sendDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons name="arrow-up" size={21} color={Colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFF8F2' },
  chatBg: { flex: 1, backgroundColor: 'transparent' },
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  emptyPad: { flexGrow: 1, justifyContent: 'center' },
  wallpaperHearts: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  wallHeart: {
    position: 'absolute',
    color: 'rgba(196,61,92,0.14)',
    fontWeight: '700',
  },
  wallHeartOne: { left: 18, top: '24%', fontSize: 34, transform: [{ rotate: '-12deg' }] },
  wallHeartTwo: { right: 22, top: '43%', fontSize: 28, transform: [{ rotate: '12deg' }] },
  wallHeartThree: { left: '47%', top: '67%', fontSize: 20 },
  wallHeartFour: {
    right: 70,
    top: '82%',
    fontSize: 38,
    transform: [{ rotate: '-8deg' }],
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { minWidth: 150, gap: 1 },
  headerName: {
    ...Typography.bodyStrong,
    color: Colors.ink,
    fontSize: 16,
    lineHeight: 20,
  },
  headerPresence: {
    ...Typography.caption,
    color: Colors.inkMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  presenceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.inkSubtle,
  },
  presenceDotOnline: {
    backgroundColor: '#72D6A0',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: Colors.roseDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  /** WhatsApp-style: your messages = soft green */
  bubbleMine: {
    backgroundColor: '#E94F78',
    borderBottomRightRadius: 6,
  },
  /** Received = white */
  bubbleTheirs: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    ...Typography.body,
    color: '#111B21',
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: { color: Colors.white },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  time: {
    ...Typography.caption,
    color: Colors.inkSubtle,
    fontSize: 10,
  },
  timeMine: { color: 'rgba(255,255,255,0.78)' },
  emojiTray: {
    maxHeight: 220,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    backgroundColor: 'rgba(255,248,242,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.roseLight,
  },
  inputShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 24,
    minHeight: 44,
    maxHeight: 120,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: Colors.roseLight,
  },
  emojiBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 36,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    ...Typography.body,
    color: '#111B21',
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
});
