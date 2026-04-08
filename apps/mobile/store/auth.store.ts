import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

interface AuthState {
  accessToken:  string | null;
  refreshToken: string | null;
  userId:       string | null;
  role:         string | null;
  isLoaded:     boolean;

  setTokens: (tokens: { accessToken: string; refreshToken: string; userId?: string; role?: string }) => Promise<void>;
  logout:    () => Promise<void>;
  hydrate:   () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken:  null,
  refreshToken: null,
  userId:       null,
  role:         null,
  isLoaded:     false,

  setTokens: async ({ accessToken, refreshToken, userId, role }) => {
    await SecureStore.setItemAsync('access_token',  accessToken);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    if (userId) await SecureStore.setItemAsync('user_id', userId);
    if (role)   await SecureStore.setItemAsync('user_role', role);
    set({ accessToken, refreshToken, userId: userId ?? null, role: role ?? null });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user_id');
    await SecureStore.deleteItemAsync('user_role');
    set({ accessToken: null, refreshToken: null, userId: null, role: null });
    router.replace('/(auth)/login');
  },

  hydrate: async () => {
    const [accessToken, refreshToken, userId, role] = await Promise.all([
      SecureStore.getItemAsync('access_token'),
      SecureStore.getItemAsync('refresh_token'),
      SecureStore.getItemAsync('user_id'),
      SecureStore.getItemAsync('user_role'),
    ]);
    set({ accessToken, refreshToken, userId, role, isLoaded: true });
  },
}));
