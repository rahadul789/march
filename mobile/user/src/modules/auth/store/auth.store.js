import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  sessionId: null,
  refreshTokenExpiresAt: null,
  hasHydrated: false
};

const useAuthStore = create(
  persist(
    (set) => ({
      ...initialState,
      setHasHydrated: (value) =>
        set({
          hasHydrated: Boolean(value)
        }),
      setAuthSession: ({ user, tokens }) =>
        set({
          user: user || null,
          accessToken: tokens?.accessToken || null,
          refreshToken: tokens?.refreshToken || null,
          sessionId: tokens?.sessionId || null,
          refreshTokenExpiresAt: tokens?.refreshTokenExpiresAt || null
        }),
      setTokens: (tokens) =>
        set((state) => ({
          accessToken: tokens?.accessToken || state.accessToken,
          refreshToken: tokens?.refreshToken || state.refreshToken,
          sessionId: tokens?.sessionId || state.sessionId,
          refreshTokenExpiresAt:
            tokens?.refreshTokenExpiresAt || state.refreshTokenExpiresAt
        })),
      setUser: (user) =>
        set({
          user: user || null
        }),
      clearAuthSession: () =>
        set({
          ...initialState,
          hasHydrated: true
        })
    }),
    {
      name: 'march-user-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        sessionId: state.sessionId,
        refreshTokenExpiresAt: state.refreshTokenExpiresAt
      }),
      onRehydrateStorage: () => (state) => {
        if (state && typeof state.setHasHydrated === 'function') {
          state.setHasHydrated(true);
        }
      }
    }
  )
);

export default useAuthStore;
