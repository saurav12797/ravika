import { useEffect, useState } from 'react';
import { subscribeToInteractions } from '@/services/interactionService';
import type { Interaction } from '@/types/models';

export function useConnectionInteractions(
  connectionId: string | undefined,
  pageSize = 40,
): {
  items: Interaction[];
  loading: boolean;
  error: Error | null;
} {
  const [items, setItems] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!connectionId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToInteractions(
      connectionId,
      (next) => {
        setItems(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      pageSize,
    );
    return unsub;
  }, [connectionId, pageSize]);

  return { items, loading, error };
}
