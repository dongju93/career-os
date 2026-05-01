import { describe, expect, it } from 'vitest';
import { resetAuthStore, useAuthStore } from './auth-store';

const sampleUser = {
  id: 'u1',
  email: 'user@example.com',
  name: 'Test User',
  picture: null,
};

describe('useAuthStore', () => {
  it('setAuth sets user and clears loading and error', () => {
    useAuthStore.getState().setLoading(true);
    useAuthStore.getState().setError('previous error');

    useAuthStore.getState().setAuth(sampleUser);

    const state = useAuthStore.getState();
    expect(state.user).toMatchObject(sampleUser);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('clearAuth resets user, loading, and error to initial values', () => {
    useAuthStore.getState().setAuth(sampleUser);
    useAuthStore.getState().setError('some error');

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setLoading updates isLoading', () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);

    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('setError sets error string and clears loading', () => {
    useAuthStore.getState().setLoading(true);
    useAuthStore.getState().setError('auth failed');

    expect(useAuthStore.getState().error).toBe('auth failed');
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('setError accepts null to clear the error', () => {
    useAuthStore.getState().setError('some error');
    useAuthStore.getState().setError(null);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('setAuth then clearAuth leaves no user in memory', () => {
    useAuthStore.getState().setAuth(sampleUser);
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setError with null clears the error and does not affect user', () => {
    useAuthStore.getState().setAuth(sampleUser);
    useAuthStore.getState().setError('transient error');
    useAuthStore.getState().setError(null);
    expect(useAuthStore.getState().error).toBeNull();
    expect(useAuthStore.getState().user).toMatchObject({ id: 'u1' });
  });
});

describe('resetAuthStore', () => {
  it('clears all in-memory state', () => {
    useAuthStore.getState().setAuth(sampleUser);
    useAuthStore.getState().setError('some error');
    useAuthStore.getState().setLoading(true);

    resetAuthStore();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});
