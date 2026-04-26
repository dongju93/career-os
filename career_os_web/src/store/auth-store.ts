import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  setAuth: (user: AuthUser) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

function createInitialState() {
  return {
    user: null,
    isLoading: false,
    error: null,
  };
}

const fallbackStorage = new Map<string, string>();

function getAuthStorage(): StateStorage {
  if (typeof window === 'undefined') {
    return {
      getItem: (name) => fallbackStorage.get(name) ?? null,
      removeItem: (name) => {
        fallbackStorage.delete(name);
      },
      setItem: (name, value) => {
        fallbackStorage.set(name, value);
      },
    };
  }

  try {
    const storage = window.localStorage;
    storage.setItem('__career-os-auth-test__', '1');
    storage.removeItem('__career-os-auth-test__');

    return {
      getItem: (name) => storage.getItem(name),
      removeItem: (name) => {
        storage.removeItem(name);
      },
      setItem: (name, value) => {
        storage.setItem(name, value);
      },
    };
  } catch {
    return {
      getItem: (name) => fallbackStorage.get(name) ?? null,
      removeItem: (name) => {
        fallbackStorage.delete(name);
      },
      setItem: (name, value) => {
        fallbackStorage.set(name, value);
      },
    };
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...createInitialState(),
      setAuth: (user) => set({ user, error: null, isLoading: false }),
      clearAuth: () => set(createInitialState()),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
    }),
    {
      name: 'career-os-auth',
      partialize: (state) => ({ user: state.user }),
      storage: createJSONStorage(getAuthStorage),
      version: 1,
      migrate: (persisted) => {
        const state = persisted as Partial<Pick<AuthState, 'user'>>;
        return { user: state.user ?? null };
      },
    },
  ),
);

export function resetAuthStore() {
  useAuthStore.setState(createInitialState());
  useAuthStore.persist.clearStorage();
}
