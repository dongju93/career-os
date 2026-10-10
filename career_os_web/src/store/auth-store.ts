import { create } from 'zustand';

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

// Earlier releases persisted a 7-day Bearer token and the user's profile
// (email, name, picture) to localStorage. Auth now lives only in the HttpOnly
// session cookie and the user is held in memory, re-fetched from /v1/auth/me
// on load (ProtectedRoute), so scrub those leftovers from returning browsers.
const LEGACY_AUTH_STORAGE_KEYS = ['career-os-access-token', 'career-os-auth'];

function removeLegacyAuthStorage() {
  if (typeof window === 'undefined') return;
  try {
    for (const key of LEGACY_AUTH_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable (private mode, blocked): nothing was persisted.
  }
}

removeLegacyAuthStorage();

export const useAuthStore = create<AuthState>()((set) => ({
  ...createInitialState(),
  setAuth: (user) => set({ user, error: null, isLoading: false }),
  clearAuth: () => set(createInitialState()),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));

export function resetAuthStore() {
  useAuthStore.setState(createInitialState());
}
