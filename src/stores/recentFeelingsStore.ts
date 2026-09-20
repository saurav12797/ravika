import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { ReactionType } from '@/types/models';

const STORAGE_KEY = 'ravika:recent-feelings:v1';
const MAX = 12;

export type RecentFeeling = {
  reactionType: ReactionType;
  emoji: string;
  title: string;
  count: number;
  lastUsedAt: number;
};

type State = {
  items: RecentFeeling[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  record: (feeling: {
    reactionType: ReactionType;
    emoji: string;
    title: string;
  }) => void;
  orderedTypes: () => ReactionType[];
};

async function persist(items: RecentFeeling[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage failures.
  }
}

export const useRecentFeelingsStore = create<State>((set, get) => ({
  items: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const items = raw ? (JSON.parse(raw) as RecentFeeling[]) : [];
      set({
        items: Array.isArray(items) ? items.slice(0, MAX) : [],
        hydrated: true,
      });
    } catch {
      set({ items: [], hydrated: true });
    }
  },

  record: (feeling) => {
    const now = Date.now();
    const prev = get().items;
    const existing = prev.find(
      (i) => String(i.reactionType) === String(feeling.reactionType),
    );
    const next: RecentFeeling[] = [
      {
        reactionType: feeling.reactionType,
        emoji: feeling.emoji,
        title: feeling.title,
        count: (existing?.count ?? 0) + 1,
        lastUsedAt: now,
      },
      ...prev.filter(
        (i) => String(i.reactionType) !== String(feeling.reactionType),
      ),
    ].slice(0, MAX);
    set({ items: next });
    void persist(next);
  },

  orderedTypes: () => get().items.map((i) => i.reactionType),
}));
