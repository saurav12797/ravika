import { useEffect, useMemo, useState } from 'react';
import {
  subscribeToConnections,
  subscribeToRequests,
} from '@/services/connectionService';
import { getUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import type { Connection, ConnectionRequest, UserProfile } from '@/types/models';

export interface ConnectionWithPeer {
  connection: Connection;
  peer: UserProfile | null;
}

export function useConnections(): {
  connections: Connection[];
  withPeers: ConnectionWithPeer[];
  pinned: ConnectionWithPeer[];
  loading: boolean;
  error: Error | null;
  refreshPeers: () => void;
} {
  const userId = useAuthStore((s) => s.user?.uid);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [peers, setPeers] = useState<Record<string, UserProfile | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [peerTick, setPeerTick] = useState(0);

  useEffect(() => {
    if (!userId) {
      setConnections((prev) => (prev.length === 0 ? prev : []));
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToConnections(
      userId,
      (items) => {
        setConnections(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId || connections.length === 0) {
      setPeers({});
      return;
    }

    let cancelled = false;
    void (async () => {
      const next: Record<string, UserProfile | null> = {};
      await Promise.all(
        connections.map(async (c) => {
          const peerId = c.userIds.find((id) => id !== userId) ?? '';
          if (!peerId) {
            next[c.id] = null;
            return;
          }
          try {
            next[c.id] = await getUser(peerId);
          } catch {
            next[c.id] = null;
          }
        }),
      );
      if (!cancelled) {
        setPeers(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connections, userId, peerTick]);

  const withPeers = useMemo<ConnectionWithPeer[]>(
    () =>
      connections.map((connection) => ({
        connection,
        peer: peers[connection.id] ?? null,
      })),
    [connections, peers],
  );

  const pinned = useMemo(() => {
    if (!userId) {
      return [];
    }
    return withPeers
      .filter((item) => item.connection.participants[userId]?.pinned)
      .sort((a, b) => {
        const ao = a.connection.participants[userId]?.pinOrder ?? 99;
        const bo = b.connection.participants[userId]?.pinOrder ?? 99;
        return ao - bo;
      })
      .slice(0, 2);
  }, [withPeers, userId]);

  return {
    connections,
    withPeers,
    pinned,
    loading,
    error,
    refreshPeers: () => setPeerTick((t) => t + 1),
  };
}

export function usePendingRequests(): {
  incoming: ConnectionRequest[];
  outgoing: ConnectionRequest[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
} {
  const userId = useAuthStore((s) => s.user?.uid);
  const [incoming, setIncoming] = useState<ConnectionRequest[]>([]);
  const [outgoing, setOutgoing] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setIncoming([]);
      setOutgoing([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending <= 0) setLoading(false);
    };

    const unsubIn = subscribeToRequests(
      'incoming',
      (items) => {
        setIncoming(items);
        setError(null);
        done();
      },
      (err) => {
        setError(err);
        done();
      },
    );
    const unsubOut = subscribeToRequests(
      'outgoing',
      (items) => {
        setOutgoing(items);
        setError(null);
        done();
      },
      (err) => {
        setError(err);
        done();
      },
    );

    return () => {
      unsubIn();
      unsubOut();
    };
  }, [userId]);

  return {
    incoming,
    outgoing,
    loading,
    error,
    /** Realtime - refresh is a no-op kept for call-site compatibility. */
    refresh: () => undefined,
  };
}
