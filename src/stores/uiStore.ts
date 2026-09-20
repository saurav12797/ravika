import { create } from 'zustand';
import type { ReactionType } from '@/types/models';

export interface IncomingReactionAnimation {
  id: string;
  reactionType: ReactionType;
  emoji: string;
  title: string;
  message?: string;
  animationId?: string;
  fromUserId: string;
  fromDisplayName: string;
  connectionId: string;
}

export interface SentCelebration {
  id: string;
  emoji: string;
  title: string;
  toDisplayName: string;
  message?: string;
}

interface UiState {
  offline: boolean;
  reducedMotion: boolean;
  incomingReactionAnimation: IncomingReactionAnimation | null;
  sentCelebration: SentCelebration | null;
  setOffline: (offline: boolean) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  showIncomingReaction: (payload: IncomingReactionAnimation) => void;
  clearIncomingReaction: () => void;
  showSentCelebration: (payload: SentCelebration) => void;
  clearSentCelebration: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  offline: false,
  reducedMotion: false,
  incomingReactionAnimation: null,
  sentCelebration: null,

  setOffline: (offline) => set({ offline }),

  setReducedMotion: (reducedMotion) => set({ reducedMotion }),

  showIncomingReaction: (payload) =>
    set({ incomingReactionAnimation: payload, sentCelebration: null }),

  clearIncomingReaction: () => set({ incomingReactionAnimation: null }),

  showSentCelebration: (payload) =>
    set({ sentCelebration: payload, incomingReactionAnimation: null }),

  clearSentCelebration: () => set({ sentCelebration: null }),
}));
