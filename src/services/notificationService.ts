import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { getCurrentUser } from '@/services/authService';
import { getDb } from '@/services/firebase';
import { getUser } from '@/services/userService';
import { AppError } from '@/utils/errors';
import type { ReactionType } from '@/types/models';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice && process.env.NODE_ENV === 'production') {
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[push] permission not granted:', finalStatus);
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('ravika', {
      name: 'Ravika feelings',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#E85A7A',
      sound: 'default',
      bypassDnd: false,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Ravika',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: '#E85A7A',
      sound: 'default',
      showBadge: true,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    '24ddcf27-90f1-41b3-b849-241b5be9b109';

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: String(projectId),
    });
    return token.data;
  } catch (err) {
    console.warn('[push] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

export async function saveDeviceToken(token: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    throw new AppError('auth/unauthenticated', 'Please sign in to continue.');
  }

  await updateDoc(doc(getDb(), 'users', user.uid), {
    deviceTokens: arrayUnion(token),
  });
}

/** Register + save with retries (waits for profile doc / network). */
export async function ensurePushTokenSaved(): Promise<string | null> {
  const token = await registerForPushNotifications();
  if (!token) {
    return null;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await saveDeviceToken(token);
      return token;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  console.warn('[push] saveDeviceToken failed after retries:', lastError);
  return null;
}

async function deliverExpoPush(
  messages: Array<{
    to: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    channelId?: string;
  }>,
): Promise<void> {
  if (messages.length === 0) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        messages.map((m) => ({
          to: m.to,
          sound: 'default',
          title: m.title,
          body: m.body,
          badge: 1,
          priority: 'high',
          channelId: m.channelId ?? 'ravika',
          data: m.data,
        })),
      ),
    });
    const json = (await res.json().catch(() => null)) as {
      data?: Array<{ status?: string; message?: string }>;
    } | null;
    if (!res.ok) {
      console.warn('[push] Expo push HTTP error', res.status, json);
      return;
    }
    for (const ticket of json?.data ?? []) {
      if (ticket.status === 'error') {
        console.warn('[push] Expo ticket error:', ticket.message ?? ticket);
      }
    }
  } catch (err) {
    console.warn('[push] deliverExpoPush failed:', err);
  }
}

function peerPushTokens(peer: Awaited<ReturnType<typeof getUser>>): string[] {
  if (!peer?.deviceTokens?.length) return [];
  const prefs = peer.notificationPreferences;
  if (prefs && prefs.pushEnabled === false) return [];
  return peer.deviceTokens.filter(
    (t) => typeof t === 'string' && t.length > 0,
  );
}

export async function notifyFeelingPush(input: {
  toUserId: string;
  fromUserId: string;
  fromDisplayName: string;
  connectionId: string;
  interactionId: string;
  reactionType: ReactionType;
  emoji: string;
  title: string;
  message?: string;
}): Promise<void> {
  const peer = await getUser(input.toUserId);
  if (!peer) return;
  if (peer.notificationPreferences?.reactionNotifications === false) return;

  const tokens = peerPushTokens(peer);
  if (tokens.length === 0) {
    console.warn(
      '[push] no deviceTokens for recipient',
      input.toUserId,
    );
    return;
  }

  const body = input.message?.trim()
    ? `${input.emoji} ${input.message.trim()}`
    : `${input.emoji} ${input.title}`;

  await deliverExpoPush(
    tokens.map((to) => ({
      to,
      title: input.fromDisplayName,
      body,
      channelId: 'ravika',
      data: {
        type: 'interaction',
        connectionId: input.connectionId,
        interactionId: input.interactionId,
        reactionType: input.reactionType,
        emoji: input.emoji,
        title: input.title,
        message: input.message ?? '',
        fromUserId: input.fromUserId,
        fromDisplayName: input.fromDisplayName,
      },
    })),
  );
}

/** Same push channel as feelings — opens the chat thread. */
export async function notifyChatPush(input: {
  toUserId: string;
  fromUserId: string;
  fromDisplayName: string;
  connectionId: string;
  messageId: string;
  text: string;
}): Promise<void> {
  const peer = await getUser(input.toUserId);
  if (!peer) return;
  if (peer.notificationPreferences?.pushEnabled === false) return;

  const tokens = peerPushTokens(peer);
  if (tokens.length === 0) {
    console.warn('[push] no deviceTokens for chat recipient', input.toUserId);
    return;
  }

  const preview =
    input.text.length > 80 ? `${input.text.slice(0, 77)}…` : input.text;

  await deliverExpoPush(
    tokens.map((to) => ({
      to,
      title: input.fromDisplayName,
      body: preview,
      channelId: 'ravika',
      data: {
        type: 'chat',
        connectionId: input.connectionId,
        messageId: input.messageId,
        fromUserId: input.fromUserId,
        fromDisplayName: input.fromDisplayName,
      },
    })),
  );
}

export async function notifyConnectionRequest(
  requestId: string,
  toUserId: string,
  fromUserId: string,
): Promise<void> {
  const [peer, from] = await Promise.all([
    getUser(toUserId),
    getUser(fromUserId),
  ]);
  if (!peer) return;
  if (peer.notificationPreferences?.requestNotifications === false) return;

  const tokens = peerPushTokens(peer);
  if (tokens.length === 0) {
    console.warn('[push] no deviceTokens for request recipient', toUserId);
    return;
  }

  const name = from?.displayName?.split(' ')[0] || 'Someone';

  await deliverExpoPush(
    tokens.map((to) => ({
      to,
      title: 'New connection request',
      body: `${name} wants to be close with you`,
      channelId: 'ravika',
      data: {
        type: 'request',
        requestId,
        fromUserId,
      },
    })),
  );
}

export type NotificationNavigation =
  | { type: 'interaction'; connectionId: string; interactionId?: string }
  | { type: 'chat'; connectionId: string; messageId?: string }
  | { type: 'request'; requestId: string }
  | { type: 'milestone'; connectionId: string; milestoneId: string }
  | { type: 'unknown' };

export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): NotificationNavigation {
  const data = response.notification.request.content.data as Record<
    string,
    unknown
  >;

  const type = String(data.type ?? '');

  if (type === 'interaction' && typeof data.connectionId === 'string') {
    return {
      type: 'interaction',
      connectionId: data.connectionId,
      interactionId:
        typeof data.interactionId === 'string'
          ? data.interactionId
          : undefined,
    };
  }

  if (type === 'chat' && typeof data.connectionId === 'string') {
    return {
      type: 'chat',
      connectionId: data.connectionId,
      messageId:
        typeof data.messageId === 'string' ? data.messageId : undefined,
    };
  }

  if (type === 'request' && typeof data.requestId === 'string') {
    return { type: 'request', requestId: data.requestId };
  }

  if (
    type === 'milestone' &&
    typeof data.connectionId === 'string' &&
    typeof data.milestoneId === 'string'
  ) {
    return {
      type: 'milestone',
      connectionId: data.connectionId,
      milestoneId: data.milestoneId,
    };
  }

  return { type: 'unknown' };
}
