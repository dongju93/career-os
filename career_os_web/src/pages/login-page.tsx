import { Alert, Button, Stack, Text, Title } from '@mantine/core';
import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useAuthStore } from '../store/auth-store';
import {
  buildGoogleLoginUrl,
  getSafeRedirectPath,
  storeRedirectPath,
} from '../utils/auth-redirect';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://career-os.fastapicloud.dev';

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginPage() {
  const token = useAuthStore((state) => state.token);
  const error = useAuthStore((state) => state.error);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setError = useAuthStore((state) => state.setError);
  const setLoading = useAuthStore((state) => state.setLoading);
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get('error');
  const nextPath = getSafeRedirectPath(searchParams.get('next'));

  useEffect(() => {
    setError(
      errorParam === 'auth_failed'
        ? 'Google login failed. Please try again.'
        : errorParam
          ? 'An unexpected error occurred. Please try again.'
          : null,
    );
  }, [errorParam, setError]);

  if (token) {
    return <Navigate replace to={nextPath === '/' ? '/job-postings' : nextPath} />;
  }

  function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    storeRedirectPath(nextPath);
    window.location.assign(
      buildGoogleLoginUrl(API_BASE_URL, window.location.origin),
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Stack gap="xl">
          <div className="flex flex-col items-center gap-5">
            <div className="app-mark text-[1.1rem]">CO</div>
            <Stack align="center" gap="xs">
              <Title
                className="text-center"
                order={1}
                style={{ fontSize: '2rem', letterSpacing: '-0.02em' }}
              >
                Career OS
              </Title>
              <Text c="dimmed" className="text-center" size="md">
                Track every application. Land your next role.
              </Text>
            </Stack>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200/70 bg-white/80 p-8 shadow-[0_24px_55px_-48px_rgba(15,23,42,0.35)] backdrop-blur">
            <Stack gap="lg">
              <Stack gap="xs">
                <Title order={3} style={{ fontSize: '1.15rem' }}>
                  Sign in to your account
                </Title>
                <Text c="dimmed" size="sm">
                  Manage job applications, track progress, and stay organized —
                  all in one place.
                </Text>
              </Stack>

              {error && (
                <Alert color="red" radius="lg" variant="light">
                  {error}
                </Alert>
              )}

              <Button
                fullWidth
                disabled={isLoading}
                leftSection={<GoogleIcon />}
                loading={isLoading}
                onClick={handleGoogleLogin}
                radius="xl"
                size="md"
                styles={{
                  root: {
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    color: '#1e293b',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: '#f8fafc',
                    },
                  },
                }}
                variant="default"
              >
                Continue with Google
              </Button>

              <Text c="dimmed" className="text-center" size="xs">
                By signing in, you agree to our Terms of Service and Privacy
                Policy.
              </Text>
            </Stack>
          </div>
        </Stack>
      </div>
    </div>
  );
}
