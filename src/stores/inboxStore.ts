import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Interaction } from '@/types/models';

const READ_KEY = 'ravika:inbox-last-read-at';

interface InboxState {
  items: Interaction[];
  loading: boolean;
  /** Epoch ms — feelings newer than this count as unread. */
  lastReadAt: number;
  setItems: (items: Interaction[]) => void;
  setLoading: (loading: boolean) => void;
  hydrateLastRead: () => Promise<void>;
  markAllRead: () => Promise<void>;
  /** @deprecated No longer hides items — marks all read only. */
  clearSeen: () => Promise<void>;
  unreadFeelingCount: () => number;
  visibleItems: () => Interaction[];
}

export const useInboxStore = create<InboxState>((set, get) => ({
  items: [],
  loading: true,
  lastReadAt: 0,

  setItems: (items) => set({ items, loading: false }),
  setLoading: (loading) => set({ loading }),

  hydrateLastRead: async () => {
    try {
      const rawRead = await AsyncStorage.getItem(READ_KEY);
      const parsedRead = rawRead ? Number(rawRead) : 0;
      set({
        lastReadAt: Number.isFinite(parsedRead) ? parsedRead : 0,
      });
    } catch {
      set({ lastReadAt: 0 });
    }
  },

  markAllRead: async () => {
    const now = Date.now();
    set({ lastReadAt: now });
    try {
      await AsyncStorage.setItem(READ_KEY, String(now));
    } catch {
      // ignore
    }
  },

  clearSeen: async () => {
    // No-op hide — Instagram-style: keep list, only mark read.
    await get().markAllRead();
  },

  unreadFeelingCount: () => {
    const { items, lastReadAt } = get();
    return items.filter((i) => i.createdAt > lastReadAt).length;
  },

  visibleItems: () => get().items,
}));
