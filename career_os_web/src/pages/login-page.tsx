import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { API_BASE_URL } from '@/services/api-base-url';
import { useAuthStore } from '@/store/auth-store';
import {
  buildGoogleLoginUrl,
  getSafeRedirectPath,
  storeRedirectPath,
} from '@/utils/auth-redirect';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    return (
      <Navigate replace to={nextPath === '/' ? '/job-postings' : nextPath} />
    );
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
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br from-primary/20 to-teal-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-tr from-cyan-500/15 to-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8 space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-teal-600 text-white font-bold text-xl shadow-xl shadow-primary/30">
            CO
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Career OS</h1>
            <p className="text-muted-foreground">
              Track every application. Land your next role.
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="glass-card">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Sign in to your account</CardTitle>
            <CardDescription className="text-balance">
              Manage job applications, track progress, and stay organized - all in one place.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full h-12 gap-3 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-sm"
              disabled={isLoading}
              loading={isLoading}
              onClick={handleGoogleLogin}
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <p className="text-center text-xs text-muted-foreground px-4">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Built for job seekers who want to stay organized
          </p>
        </div>
      </div>
    </div>
  );
}
