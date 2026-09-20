import { useEffect, useState } from 'react';
import { listConnections } from '@/services/connectionService';
import { getUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import type { Connection, UserProfile } from '@/types/models';

export function useConnectionDetail(connectionId: string | undefined): {
  connection: Connection | null;
  peer: UserProfile | null;
  peerId: string | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
} {
  const userId = useAuthStore((s) => s.user?.uid);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [peer, setPeer] = useState<UserProfile | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!connectionId || !userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const all = await listConnections(userId);
        const found = all.find((c) => c.id === connectionId) ?? null;
        if (!found) {
          throw new Error('Connection not found');
        }
        const otherId = found.userIds.find((id) => id !== userId) ?? null;
        const other = otherId ? await getUser(otherId) : null;
        if (!cancelled) {
          setConnection(found);
          setPeer(other);
          setPeerId(otherId);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connectionId, userId, tick]);

  return {
    connection,
    peer,
    peerId,
    loading,
    error,
    reload: () => setTick((t) => t + 1),
  };
}
