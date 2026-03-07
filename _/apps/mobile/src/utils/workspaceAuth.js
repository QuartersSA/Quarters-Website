import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const storageKey = "workspaceUser";

export const useWorkspaceAuthStore = create((set) => ({
  isReady: false,
  user: null,
  initiate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(storageKey);
      set({ user: stored ? JSON.parse(stored) : null, isReady: true });
    } catch (e) {
      console.error(e);
      set({ user: null, isReady: true });
    }
  },
  setUser: async (user) => {
    try {
      if (user) {
        await SecureStore.setItemAsync(storageKey, JSON.stringify(user));
      } else {
        await SecureStore.deleteItemAsync(storageKey);
      }
    } catch (e) {
      console.error(e);
    }
    set({ user });
  },
}));

export function useWorkspaceAuth() {
  const { isReady, user, initiate, setUser } = useWorkspaceAuthStore();

  const signOut = async () => {
    await setUser(null);
  };

  return {
    isReady,
    user,
    token: user?.token ?? null,
    employeeId: user?.id ?? null,
    isAuthenticated: isReady ? !!user?.id : null,
    initiate,
    setUser,
    signOut,
  };
}
