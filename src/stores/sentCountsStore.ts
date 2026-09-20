import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { ReactionType } from '@/types/models';

const STORAGE_KEY = 'ravika:sent-counts:v1';

type State = {
  byReaction: Record<string, number>;
  total: number;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  record: (reactionType: ReactionType | string | number) => void;
  /** Merge remote tallies without lowering local counts. */
  mergeRemote: (byReaction: Record<string, number>, total: number) => void;
};

async function persist(byReaction: Record<string, number>, total: number) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ byReaction, total }),
    );
  } catch {
    // ignore
  }
}

function sum(by: Record<string, number>): number {
  return Object.values(by).reduce((a, b) => a + b, 0);
}

export const useSentCountsStore = create<State>((set, get) => ({
  byReaction: {},
  total: 0,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          byReaction?: Record<string, number>;
          total?: number;
        };
        const byReaction = parsed.byReaction ?? {};
        set({
          byReaction,
          total: parsed.total ?? sum(byReaction),
          hydrated: true,
        });
        return;
      }
    } catch {
      // fall through
    }
    set({ hydrated: true });
  },

  record: (reactionType) => {
    const key = String(reactionType);
    const byReaction = {
      ...get().byReaction,
      [key]: (get().byReaction[key] ?? 0) + 1,
    };
    const total = sum(byReaction);
    set({ byReaction, total });
    void persist(byReaction, total);
  },

  mergeRemote: (remoteBy, remoteTotal) => {
    const local = get().byReaction;
    const merged: Record<string, number> = { ...local };
    for (const [key, value] of Object.entries(remoteBy)) {
      merged[key] = Math.max(merged[key] ?? 0, value ?? 0);
    }
    const total = Math.max(sum(merged), remoteTotal, get().total);
    set({ byReaction: merged, total });
    void persist(merged, total);
  },
}));
