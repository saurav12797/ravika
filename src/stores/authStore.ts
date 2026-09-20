import type { User } from 'firebase/auth';
import { create } from 'zustand';
import type { UserProfile } from '@/types/models';
import * as authService from '@/services/authService';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => Promise<void>;
  hydrate: (user: User | null, profile: UserProfile | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: user != null,
    }),

  setProfile: (profile) => set({ profile }),

  setLoading: (isLoading) => set({ isLoading }),

  hydrate: (user, profile) =>
    set({
      user,
      profile,
      isAuthenticated: user != null,
      isLoading: false,
    }),

  logout: async () => {
    await authService.signOut();
    set({
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
