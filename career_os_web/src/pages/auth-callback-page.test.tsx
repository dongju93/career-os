import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../services/api-client';
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
  afterEach(() => {
    setAccessToken(null);
  });

  it('exchanges the login_code for a Bearer token before checking the session', async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === 'https://career-os.fastapicloud.dev/v1/auth/token') {
        expect(init?.body).toBe(JSON.stringify({ login_code: 'the-code' }));
        return {
          ok: true,
          json: async () =>
            apiResponse({ access_token: 'tok-abc', token_type: 'bearer' }),
        };
      }
      if (input === 'https://career-os.fastapicloud.dev/v1/auth/me') {
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe('Bearer tok-abc');
        return { ok: true, json: async () => apiResponse(authUser) };
      }
      if (
        input.startsWith('https://career-os.fastapicloud.dev/v1/job-postings')
      ) {
        return { ok: true, json: async () => apiResponse(emptyJobPostingPage) };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { router } = renderRoute('/auth/callback?login_code=the-code');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/job-postings');
    });
  });

  it('still completes login via the session cookie when the exchange fails', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input === 'https://career-os.fastapicloud.dev/v1/auth/token') {
        return {
          ok: false,
          status: 400,
          json: async () => ({ detail: '만료' }),
        };
      }
      if (input === 'https://career-os.fastapicloud.dev/v1/auth/me') {
        return { ok: true, json: async () => apiResponse(authUser) };
      }
      if (
        input.startsWith('https://career-os.fastapicloud.dev/v1/job-postings')
      ) {
        return { ok: true, json: async () => apiResponse(emptyJobPostingPage) };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { router } = renderRoute('/auth/callback?login_code=stale-code');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/job-postings');
    });
  });

  it('skips the exchange entirely when no login_code is present', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input === 'https://career-os.fastapicloud.dev/v1/auth/me') {
        return { ok: true, json: async () => apiResponse(authUser) };
      }
      if (
        input.startsWith('https://career-os.fastapicloud.dev/v1/job-postings')
      ) {
        return { ok: true, json: async () => apiResponse(emptyJobPostingPage) };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { router } = renderRoute('/auth/callback');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/job-postings');
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://career-os.fastapicloud.dev/v1/auth/token',
      expect.anything(),
    );
  });
});
