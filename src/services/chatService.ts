import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  limit,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getCurrentUser } from '@/services/authService';
import { getDb } from '@/services/firebase';
import { toMillis } from '@/services/firestoreUtils';
import { notifyChatPush } from '@/services/notificationService';
import { useAuthStore } from '@/stores/authStore';
import type { ChatMessage, ChatMessageStatus, ChatThread } from '@/types/models';
import { AppError } from '@/utils/errors';

const CHATS = 'chats';
const MESSAGES = 'messages';

function mapMessage(
  id: string,
  data: Record<string, unknown>,
  connectionId: string,
): ChatMessage {
  return {
    id,
    connectionId,
    fromUserId: String(data.fromUserId ?? ''),
    text: String(data.text ?? ''),
    createdAt: toMillis(data.createdAt as Parameters<typeof toMillis>[0]),
    status: (data.status as ChatMessageStatus) || 'sent',
    deliveredAt: data.deliveredAt
      ? toMillis(data.deliveredAt as Parameters<typeof toMillis>[0])
      : undefined,
    readAt: data.readAt
      ? toMillis(data.readAt as Parameters<typeof toMillis>[0])
      : undefined,
  };
}

function mapThread(id: string, data: Record<string, unknown>): ChatThread {
  const userIds = (data.userIds as string[]) ?? [];
  return {
    connectionId: id,
    userIds: [userIds[0] ?? '', userIds[1] ?? ''] as [string, string],
    lastMessage: data.lastMessage ? String(data.lastMessage) : undefined,
    lastMessageAt: data.lastMessageAt
      ? toMillis(data.lastMessageAt as Parameters<typeof toMillis>[0])
      : undefined,
    lastFromUserId: data.lastFromUserId
      ? String(data.lastFromUserId)
      : undefined,
    unreadCounts: (data.unreadCounts as Record<string, number>) ?? {},
    updatedAt: toMillis(data.updatedAt as Parameters<typeof toMillis>[0]),
  };
}

function sortedPair(userIds: [string, string]): [string, string] {
  return [...userIds].sort() as [string, string];
}

/**
 * Live messages for a connection chat (oldest → newest).
 */
export function subscribeToChatMessages(
  connectionId: string,
  onChange: (items: ChatMessage[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), CHATS, connectionId, MESSAGES),
    orderBy('createdAt', 'asc'),
    limit(200),
  );
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) =>
          mapMessage(d.id, d.data() as Record<string, unknown>, connectionId),
        ),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeToChatThread(
  connectionId: string,
  onChange: (thread: ChatThread | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), CHATS, connectionId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(mapThread(snap.id, snap.data() as Record<string, unknown>));
    },
    (err) => onError?.(err),
  );
}

/** Live last-message previews for the Chats tab. */
export function subscribeToChatThreads(
  connectionIds: string[],
  onChange: (byId: Record<string, ChatThread | null>) => void,
): Unsubscribe {
  const state: Record<string, ChatThread | null> = {};
  const unsubs = connectionIds.map((id) =>
    subscribeToChatThread(id, (thread) => {
      state[id] = thread;
      onChange({ ...state });
    }),
  );
  return () => {
    for (const u of unsubs) u();
  };
}

/**
 * Send a chat message + update the thread preview/unread in two steps so
 * Firestore rules stay predictable (batch merges were failing on some devices).
 */
export async function sendChatMessage(input: {
  connectionId: string;
  toUserId: string;
  text: string;
  /** Pass from connection.userIds to seed the thread without a getDoc. */
  userIds: [string, string];
}): Promise<ChatMessage> {
  const user = getCurrentUser();
  if (!user) {
    throw new AppError('auth/unauthenticated', 'Please sign in to continue.');
  }
  const text = input.text.trim();
  if (!text) {
    throw new AppError('unknown', 'Message cannot be empty.');
  }
  if (text.length > 2000) {
    throw new AppError('unknown', 'Message is too long.');
  }
  const pair = sortedPair(input.userIds);
  if (!pair.includes(user.uid) || !pair.includes(input.toUserId)) {
    throw new AppError('unknown', 'You are not part of this chat.');
  }

  const now = Date.now();
  const msgRef = doc(
    collection(getDb(), CHATS, input.connectionId, MESSAGES),
  );
  const threadRef = doc(getDb(), CHATS, input.connectionId);

  const messagePayload = {
    connectionId: input.connectionId,
    fromUserId: user.uid,
    text,
    createdAt: now,
    status: 'sent' as const,
  };

  try {
    await setDoc(msgRef, messagePayload);
  } catch (err) {
    throw new AppError(
      'permission-denied',
      'Could not send message. Check chat permissions / Firestore rules.',
      err,
    );
  }

  try {
    await setDoc(
      threadRef,
      {
        userIds: pair,
        lastMessage: text.slice(0, 120),
        lastMessageAt: now,
        lastFromUserId: user.uid,
        updatedAt: serverTimestamp(),
        unreadCounts: {
          [input.toUserId]: increment(1),
        },
      },
      { merge: true },
    );
  } catch (err) {
    // Message already saved — thread preview may catch up on retry/read.
    console.warn('[chat] thread preview update failed', err);
  }

  const message: ChatMessage = {
    id: msgRef.id,
    connectionId: input.connectionId,
    fromUserId: user.uid,
    text,
    createdAt: now,
    status: 'sent',
  };

  const fromName =
    useAuthStore.getState().profile?.displayName?.trim() || 'Someone';
  void notifyChatPush({
    toUserId: input.toUserId,
    fromUserId: user.uid,
    fromDisplayName: fromName,
    connectionId: input.connectionId,
    messageId: message.id,
    text,
  });

  return message;
}

/** Mark inbound as delivered (single ✓ → double grey ✓✓). Peer is online. */
export async function markMessagesDelivered(
  connectionId: string,
  messageIds: string[],
): Promise<void> {
  const user = getCurrentUser();
  if (!user || messageIds.length === 0) return;
  const unique = [...new Set(messageIds)].slice(0, 40);
  const batch = writeBatch(getDb());
  const now = Date.now();
  for (const id of unique) {
    batch.update(doc(getDb(), CHATS, connectionId, MESSAGES, id), {
      status: 'delivered',
      deliveredAt: now,
    });
  }
  await batch.commit();
}

/** Mark inbound as read (blue ✓✓) + clear unread. */
export async function markMessagesRead(
  connectionId: string,
  messageIds: string[],
): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;
  const now = Date.now();
  const unique = [...new Set(messageIds)].slice(0, 40);
  if (unique.length > 0) {
    const batch = writeBatch(getDb());
    for (const id of unique) {
      batch.update(doc(getDb(), CHATS, connectionId, MESSAGES, id), {
        status: 'read',
        readAt: now,
        deliveredAt: now,
      });
    }
    await batch.commit();
  }
  try {
    await updateDoc(doc(getDb(), CHATS, connectionId), {
      [`unreadCounts.${user.uid}`]: 0,
      updatedAt: serverTimestamp(),
    });
  } catch {
    await setDoc(
      doc(getDb(), CHATS, connectionId),
      { [`unreadCounts.${user.uid}`]: 0, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}
