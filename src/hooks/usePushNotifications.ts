import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  ensurePushTokenSaved,
  handleNotificationResponse,
} from '@/services/notificationService';
import { markMessagesDelivered } from '@/services/chatService';
import { getReactionDefinition } from '@/constants/reactions';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import type { ReactionType } from '@/types/models';

function openChatFromNotification(
  router: ReturnType<typeof useRouter>,
  connectionId: string,
): void {
  router.replace(`/chat/${connectionId}`);
}

/**
 * Registers for push once the user has a Firestore profile (so deviceTokens
 * can be saved), and re-registers when the app returns to the foreground.
 */
export function usePushNotifications(): void {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.uid);
  const hasProfile = useAuthStore((s) => Boolean(s.profile?.id));
  const showIncomingReaction = useUiStore((s) => s.showIncomingReaction);
  const handledColdStartRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !userId || !hasProfile) {
      return;
    }

    let cancelled = false;

    const sync = () => {
      void ensurePushTokenSaved().then((token) => {
        if (!cancelled && !token) {
          console.warn('[push] token not registered yet');
        }
      });
    };

    sync();

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        sync();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [userId, hasProfile]);

  useEffect(() => {
    if (Platform.OS === 'web' || !hasProfile) {
      return;
    }

    if (!handledColdStartRef.current) {
      handledColdStartRef.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        const nav = handleNotificationResponse(response);
        if (nav.type === 'chat') {
          openChatFromNotification(router, nav.connectionId);
        }
      });
    }

    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<
        string,
        unknown
      >;
      const type = String(data.type ?? '');

      // Peer device is online → double tick for the sender.
      if (
        type === 'chat' &&
        typeof data.connectionId === 'string' &&
        typeof data.messageId === 'string'
      ) {
        void markMessagesDelivered(data.connectionId, [data.messageId]).catch(
          () => undefined,
        );
        return;
      }

      if (type !== 'interaction') {
        return;
      }

      const reactionType = data.reactionType as ReactionType | undefined;
      const def =
        reactionType != null ? getReactionDefinition(reactionType) : undefined;

      showIncomingReaction({
        id: String(data.interactionId ?? Date.now()),
        reactionType: reactionType ?? 1,
        emoji: String(data.emoji ?? def?.emoji ?? '💫'),
        title: String(data.title ?? def?.title ?? 'New feeling'),
        message: String(data.message ?? notification.request.content.body ?? ''),
        animationId: def?.animationId,
        fromUserId: String(data.fromUserId ?? ''),
        fromDisplayName: String(
          data.fromDisplayName ?? notification.request.content.title ?? 'Someone',
        ),
        connectionId: String(data.connectionId ?? ''),
      });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const nav = handleNotificationResponse(response);
        if (nav.type === 'chat') {
          openChatFromNotification(router, nav.connectionId);
          return;
        }
        if (nav.type === 'interaction') {
          router.push(`/connection/${nav.connectionId}/reactions`);
        } else if (nav.type === 'request') {
          router.push('/(tabs)/activity');
        } else if (nav.type === 'milestone') {
          router.push(`/connection/${nav.connectionId}/stats`);
        }
      },
    );

    return () => {
      sub.remove();
      responseSub.remove();
    };
  }, [router, showIncomingReaction, hasProfile]);
}
