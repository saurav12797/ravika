import { useEffect, useRef } from 'react';
import { subscribeToReceivedFeelings } from '@/services/interactionService';
import { getUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { useInboxStore } from '@/stores/inboxStore';
import { useUiStore } from '@/stores/uiStore';
import { useConnections } from '@/hooks/useConnections';

/**
 * Mount once near the root (AuthGate). Keeps a single realtime inbox
 * subscription shared by the bell badge and the Notifications tab.
 */
export function useRealtimeInboxSync(): void {
  const userId = useAuthStore((s) => s.user?.uid);
  const { connections } = useConnections();
  const setItems = useInboxStore((s) => s.setItems);
  const setLoading = useInboxStore((s) => s.setLoading);
  const showIncomingReaction = useUiStore((s) => s.showIncomingReaction);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  const connectionIds = connections.map((c) => c.id).join(',');

  useEffect(() => {
    void useInboxStore.getState().hydrateLastRead();
  }, []);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const ids = connectionIds ? connectionIds.split(',').filter(Boolean) : [];
    setLoading(true);
    primedRef.current = false;
    seenRef.current = new Set();

    const unsub = subscribeToReceivedFeelings(
      userId,
      ids,
      (next) => {
        setItems(next);

        if (!primedRef.current) {
          for (const item of next) seenRef.current.add(item.id);
          primedRef.current = true;
          return;
        }

        const fresh = next.filter((item) => !seenRef.current.has(item.id));
        for (const item of fresh) {
          seenRef.current.add(item.id);
          void (async () => {
            const from = await getUser(item.fromUserId);
            showIncomingReaction({
              id: item.id,
              reactionType: item.reactionType,
              emoji: item.emoji,
              title: item.title,
              message: item.message,
              animationId: item.animationId,
              fromUserId: item.fromUserId,
              fromDisplayName: from?.displayName ?? 'Someone',
              connectionId: item.connectionId,
            });
          })();
        }
      },
      () => setLoading(false),
    );

    return unsub;
  }, [
    userId,
    connectionIds,
    setItems,
    setLoading,
    showIncomingReaction,
  ]);
}
