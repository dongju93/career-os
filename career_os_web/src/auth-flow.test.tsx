import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './store/auth-store';
import { renderRoute } from './test/test-utils';
import { buildGoogleLoginUrl } from './utils/auth-redirect';

const emptyJobPostingPage = {
  items: [],
  total: 0,
  offset: 0,
  limit: 50,
};

describe('authentication flow', () => {
  it('redirects unauthenticated visitors to the login page with the original path', async () => {
    const { router } = renderRoute('/job-postings?tab=filters');

    expect(
      await screen.findByRole('heading', { name: /^Career OS$/i }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      '?next=%2Fjob-postings%3Ftab%3Dfilters',
    );
  });

  it('redirects authenticated users away from the login page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => emptyJobPostingPage,
    });

    vi.stubGlobal('fetch', fetchMock);

    useAuthStore.getState().setAuth(
      {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Career OS User',
        picture: null,
      },
      'test-token',
    );

    const { router } = renderRoute('/login?next=%2Fjob-postings');

    expect(
      await screen.findByRole('heading', {
        name: /^채용공고$/i,
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/job-postings');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://career-os.fastapicloud.dev/v1/job-postings?offset=0&limit=50',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
      }),
    );
  });

  it('builds the Google OAuth entry URL with the frontend callback URL', () => {
    expect(
      buildGoogleLoginUrl(
        'https://career-os.fastapicloud.dev',
        'http://127.0.0.1:4173',
      ),
    ).toBe(
      'https://career-os.fastapicloud.dev/v1/auth/google?callback_url=http%3A%2F%2F127.0.0.1%3A4173%2Fauth%2Fcallback',
    );
  });

  it('completes the callback flow and navigates to the stored page', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input === 'https://career-os.fastapicloud.dev/v1/auth/me') {
        return {
          ok: true,
          json: async () => ({
            user_id: 'user-1',
            email: 'user@example.com',
            name: 'Career OS User',
            picture: null,
          }),
        };
      }

      if (
        input ===
        'https://career-os.fastapicloud.dev/v1/job-postings?offset=0&limit=50'
      ) {
        return {
          ok: true,
          json: async () => emptyJobPostingPage,
        };
      }

      throw new Error(`Unexpected fetch request: ${input}`);
    });

    vi.stubGlobal('fetch', fetchMock);
    window.sessionStorage.setItem('career-os-auth-return-to', '/job-postings');

    const { router } = renderRoute('/auth/callback?access_token=test-token');

    expect(
      await screen.findByRole('heading', {
        name: /^채용공고$/i,
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://career-os.fastapicloud.dev/v1/auth/me',
      {
        headers: { Authorization: 'Bearer test-token' },
      },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://career-os.fastapicloud.dev/v1/job-postings?offset=0&limit=50',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
      }),
    );
    expect(router.state.location.pathname).toBe('/job-postings');
    expect(useAuthStore.getState().token).toBe('test-token');
    expect(
      window.sessionStorage.getItem('career-os-auth-return-to'),
    ).toBeNull();
  });

  it('returns to the login page with an error when callback login fails', async () => {
    window.sessionStorage.setItem('career-os-auth-return-to', '/job-postings');

    const { router } = renderRoute('/auth/callback?error=auth_failed');

    expect(
      await screen.findByRole('heading', { name: /^Career OS$/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/로그인에 실패했습니다\. 다시 시도해주세요\./i),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      '?next=%2Fjob-postings&error=auth_failed',
    );
  });
});
