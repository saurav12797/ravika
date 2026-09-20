import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
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
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { EmojiPicker } from '@/components/EmojiPicker';
import { useConnections } from '@/hooks/useConnections';
import {
  markMessagesRead,
  sendChatMessage,
  subscribeToChatMessages,
} from '@/services/chatService';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type { ChatMessage } from '@/types/models';
import { toUserMessage } from '@/utils/errors';
import { format } from 'date-fns';

/**
 * WhatsApp-style ticks:
 * ✓ sent · ✓✓ delivered · blue ✓✓ read
 */
function Tick({ status }: { status: ChatMessage['status'] }) {
  if (status === 'read') {
    return (
      <Text style={[styles.ticks, styles.ticksBlue]} accessibilityLabel="Read">
        ✓✓
      </Text>
    );
  }
  if (status === 'delivered') {
    return (
      <Text style={[styles.ticks, styles.ticksGrey]} accessibilityLabel="Delivered">
        ✓✓
      </Text>
    );
  }
  return (
    <Text style={[styles.ticks, styles.ticksGrey]} accessibilityLabel="Sent">
      ✓
    </Text>
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
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
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
  const peerName =
    peerEntry?.peer?.displayName ||
    peerEntry?.peer?.username ||
    'Chat';
  const toUserId =
    peerEntry?.connection.userIds.find((uid) => uid !== userId) ?? '';
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
    return (
      <ErrorState
        error={new Error('Missing chat')}
        onRetry={() => router.back()}
      />
    );
  }

  if (connectionsLoading && !peerEntry) {
    return <LoadingState label="Opening chat…" />;
  }

  const headerOffset = insets.top + 56;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: peerName }} />

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
              paddingBottom: keyboardVisible ? Spacing.lg : Spacing.md,
            },
          ]}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
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
              <View
                style={[
                  styles.bubbleRow,
                  mine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleTheirs,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      mine && styles.bubbleTextMine,
                    ]}
                  >
                    {item.text}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.time, mine && styles.timeMine]}>
                      {item.createdAt
                        ? format(item.createdAt, 'h:mm a')
                        : ''}
                    </Text>
                    {mine ? <Tick status={item.status} /> : null}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerOffset : 0}
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
              paddingBottom: keyboardVisible
                ? Spacing.sm
                : Math.max(insets.bottom, Spacing.sm),
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
                color="#54656F"
              />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message"
              placeholderTextColor="#8696A0"
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
            <Ionicons name="send" size={18} color={Colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#EFE7DE' },
  chatBg: { flex: 1, backgroundColor: '#EFE7DE' },
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  emptyPad: { flexGrow: 1, justifyContent: 'center' },
  bubbleRow: { flexDirection: 'row', marginBottom: Spacing.xs },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
  },
  /** WhatsApp-style: your messages = soft green */
  bubbleMine: {
    backgroundColor: '#D9FDD3',
    borderTopRightRadius: 2,
  },
  /** Received = white */
  bubbleTheirs: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 2,
  },
  bubbleText: {
    ...Typography.body,
    color: '#111B21',
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: { color: '#111B21' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  time: {
    ...Typography.caption,
    color: '#667781',
    fontSize: 10,
  },
  timeMine: { color: '#667781' },
  ticks: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -1,
  },
  ticksGrey: { color: '#667781' },
  ticksBlue: { color: '#53BDEB' },
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
    backgroundColor: '#F0F2F5',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D7DB',
  },
  inputShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    minHeight: 44,
    maxHeight: 120,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
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
    backgroundColor: '#00A884',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
});
