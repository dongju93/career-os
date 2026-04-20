import { Loader, Stack, Text } from '@mantine/core';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '../store/auth-store';
import {
  buildLoginPath,
  consumeStoredRedirectPath,
  getSafeRedirectPath,
  readStoredRedirectPath,
} from '../utils/auth-redirect';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://career-os.fastapicloud.dev';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth, setError, setLoading } = useAuthStore();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const accessToken = searchParams.get('access_token');
    const oauthError = searchParams.get('error');
    const nextPath = readStoredRedirectPath(
      getSafeRedirectPath(searchParams.get('next')),
    );

    setLoading(true);

    if (oauthError || !accessToken) {
      setError('Google login failed. Please try again.');
      navigate(buildLoginPath(nextPath, { error: 'auth_failed' }), {
        replace: true,
      });
      return;
    }

    fetch(`${API_BASE_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch user');
        return res.json();
      })
      .then((data) => {
        setAuth(
          {
            id: data.user_id,
            email: data.email,
            name: data.name ?? null,
            picture: data.picture ?? null,
          },
          accessToken,
        );
        navigate(consumeStoredRedirectPath(nextPath), { replace: true });
      })
      .catch(() => {
        setError('Failed to complete login. Please try again.');
        navigate(buildLoginPath(nextPath, { error: 'auth_failed' }), {
          replace: true,
        });
      });
  }, [navigate, searchParams, setAuth, setError, setLoading]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Stack align="center" gap="md">
        <Loader color="orange" size="lg" />
        <Text c="dimmed" size="sm">
          Completing sign-in…
        </Text>
      </Stack>
    </div>
  );
}
