import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './store/auth-store';
import { renderRoute } from './test/test-utils';
import { buildGoogleLoginUrl } from './utils/auth-redirect';

describe('authentication flow', () => {
  it('redirects unauthenticated visitors to the login page with the original path', async () => {
    const { router } = renderRoute('/tooling?tab=filters');

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      '?next=%2Ftooling%3Ftab%3Dfilters',
    );
  });

  it('redirects authenticated users away from the login page', async () => {
    useAuthStore.getState().setAuth(
      {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Career OS User',
        picture: null,
      },
      'test-token',
    );

    renderRoute('/login?next=%2Ftooling');

    expect(
      await screen.findByRole('heading', {
        name: /each installed package now has a working entry point/i,
      }),
    ).toBeInTheDocument();
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user_id: 'user-1',
        email: 'user@example.com',
        name: 'Career OS User',
        picture: null,
      }),
    });

    vi.stubGlobal('fetch', fetchMock);
    window.sessionStorage.setItem('career-os-auth-return-to', '/tooling');

    const { router } = renderRoute('/auth/callback?access_token=test-token');

    expect(
      await screen.findByRole('heading', {
        name: /each installed package now has a working entry point/i,
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://career-os.fastapicloud.dev/v1/auth/me',
      {
        headers: { Authorization: 'Bearer test-token' },
      },
    );
    expect(router.state.location.pathname).toBe('/tooling');
    expect(useAuthStore.getState().token).toBe('test-token');
  });

  it('returns to the login page with an error when callback login fails', async () => {
    window.sessionStorage.setItem('career-os-auth-return-to', '/tooling');

    const { router } = renderRoute('/auth/callback?error=auth_failed');

    expect(
      await screen.findByRole('heading', { name: /sign in to your account/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/google login failed/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      '?next=%2Ftooling&error=auth_failed',
    );
  });
});
