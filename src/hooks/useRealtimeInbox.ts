import { useInboxStore } from '@/stores/inboxStore';
import type { Interaction } from '@/types/models';

/** Read the shared realtime inbox (synced once from AuthGate). */
export function useRealtimeInbox(): {
  items: Interaction[];
  loading: boolean;
} {
  const items = useInboxStore((s) => s.items);
  const loading = useInboxStore((s) => s.loading);
  return { items, loading };
}
