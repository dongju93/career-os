import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderRoute } from '../test/test-utils';

vi.mock('@openai/chatkit-react', () => ({
  useChatKit: () => ({
    control: {},
    setThreadId: vi.fn(),
    showHistory: vi.fn(),
    hideHistory: vi.fn(),
    focusComposer: vi.fn(),
  }),
  ChatKit: () => null,
}));

function apiResponse<T>(data: T) {
  return { status: 200, message: 'ok', data };
}

const authUser = {
  user_id: 'user-1',
  email: 'user@example.com',
  name: 'Career OS User',
  picture: null,
};

const emptyJobPostingPage = { items: [], total: 0, offset: 0, limit: 50 };

describe('AuthCallbackPage', () => {
  it('completes login through the session cookie alone', async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === '/v1/auth/me') {
        expect(new Headers(init?.headers).has('Authorization')).toBe(false);
        return { ok: true, json: async () => apiResponse(authUser) };
      }
      if (input.startsWith('/v1/job-postings')) {
        return { ok: true, json: async () => apiResponse(emptyJobPostingPage) };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    // A stale link from an older backend may still carry login_code; it must
    // be ignored rather than exchanged for a token.
    const { router } = renderRoute('/auth/callback?login_code=stale-code');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/job-postings');
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/v1/auth/token',
      expect.anything(),
    );
  });
});
