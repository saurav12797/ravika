import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { ReactionType } from '@/types/models';

const PREFIX = 'ravika:conn-feeling-usage:v1:';
const MAX = 40;

export type FeelingUsage = {
  /** Predefined id, or `custom:{sharedFeelingId}`. */
  key: string;
  reactionType: ReactionType;
  customFeelingId?: string;
  emoji: string;
  title: string;
  count: number;
  lastUsedAt: number;
};

/** Stable empty list — never allocate a fresh `[]` in Zustand selectors. */
export const EMPTY_FEELING_USAGE: FeelingUsage[] = [];

type ConnBucket = {
  items: FeelingUsage[];
  hydrated: boolean;
};

type State = {
  byConnection: Record<string, ConnBucket>;
  hydrate: (
    connectionId: string,
    options?: { force?: boolean },
  ) => Promise<void>;
  record: (
    connectionId: string,
    feeling: {
      reactionType: ReactionType;
      emoji: string;
      title: string;
      customFeelingId?: string;
    },
  ) => void;
  getItems: (connectionId: string) => FeelingUsage[];
};

function storageKey(connectionId: string) {
  return `${PREFIX}${connectionId}`;
}

function feelingKey(
  reactionType: ReactionType,
  customFeelingId?: string,
): string {
  if (customFeelingId) return `custom:${customFeelingId}`;
  return String(reactionType);
}

async function persist(connectionId: string, items: FeelingUsage[]) {
  try {
    await AsyncStorage.setItem(storageKey(connectionId), JSON.stringify(items));
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Per-connection recent + frequency for one-tap grids with that person.
 */
export const useConnectionFeelingUsageStore = create<State>((set, get) => ({
  byConnection: {},

  hydrate: async (connectionId, options) => {
    const force = options?.force === true;
    const existing = get().byConnection[connectionId];
    if (existing?.hydrated && !force) return;

    // Mark hydrated immediately so concurrent callers don't loop setState.
    set({
      byConnection: {
        ...get().byConnection,
        [connectionId]: {
          items: existing?.items ?? EMPTY_FEELING_USAGE,
          hydrated: true,
        },
      },
    });

    try {
      const raw = await AsyncStorage.getItem(storageKey(connectionId));
      const parsed = raw ? (JSON.parse(raw) as FeelingUsage[]) : null;
      const items =
        Array.isArray(parsed) && parsed.length > 0
          ? parsed
              .slice()
              .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return b.lastUsedAt - a.lastUsedAt;
              })
              .slice(0, MAX)
          : EMPTY_FEELING_USAGE;
      set({
        byConnection: {
          ...get().byConnection,
          [connectionId]: { items, hydrated: true },
        },
      });
    } catch {
      set({
        byConnection: {
          ...get().byConnection,
          [connectionId]: { items: EMPTY_FEELING_USAGE, hydrated: true },
        },
      });
    }
  },

  record: (connectionId, feeling) => {
    const now = Date.now();
    const key = feelingKey(feeling.reactionType, feeling.customFeelingId);
    const prev = get().byConnection[connectionId]?.items ?? EMPTY_FEELING_USAGE;
    const existing = prev.find((i) => i.key === key);
    const next: FeelingUsage[] = [
      {
        key,
        reactionType: feeling.reactionType,
        customFeelingId: feeling.customFeelingId,
        emoji: feeling.emoji,
        title: feeling.title,
        count: (existing?.count ?? 0) + 1,
        lastUsedAt: now,
      },
      ...prev.filter((i) => i.key !== key),
    ]
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.lastUsedAt - a.lastUsedAt;
      })
      .slice(0, MAX);

    set({
      byConnection: {
        ...get().byConnection,
        [connectionId]: { items: next, hydrated: true },
      },
    });
    void persist(connectionId, next);
  },

  getItems: (connectionId) =>
    get().byConnection[connectionId]?.items ?? EMPTY_FEELING_USAGE,
}));

/** Safe selector — always returns a stable array reference when empty. */
export function selectFeelingUsageItems(
  connectionId: string,
): (state: State) => FeelingUsage[] {
  return (state) =>
    state.byConnection[connectionId]?.items ?? EMPTY_FEELING_USAGE;
}
