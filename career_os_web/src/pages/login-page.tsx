import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { API_BASE_URL } from '../services/api-base-url';
import { useAuthStore } from '../store/auth-store';
import {
  buildGoogleLoginUrl,
  getSafeRedirectPath,
  storeRedirectPath,
} from '../utils/auth-redirect';

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
        ? '로그인에 실패했습니다. 다시 시도해주세요.'
        : errorParam
          ? '예상치 못한 오류가 발생했습니다. 다시 시도해주세요.'
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background decoration blobs */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/20 to-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-teal-500/15 to-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"
      />

      <Card className="w-full max-w-md mx-4 animate-fade-in">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-teal-600 text-white font-bold text-xl flex items-center justify-center shadow-xl">
              CO
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight">Career OS</h1>
              <p className="text-muted-foreground mt-1">
                채용 공고 관리 시스템
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Google sign-in */}
          <button
            className="w-full h-12 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-sm rounded-xl flex items-center justify-center gap-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
            type="button"
            onClick={handleGoogleLogin}
          >
            {isLoading ? (
              <svg
                aria-hidden="true"
                className="animate-spin"
                fill="none"
                height={16}
                viewBox="0 0 24 24"
                width={16}
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <GoogleIcon />
            )}
            Google로 계속하기
          </button>

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center mt-6">
            계속함으로써 서비스 이용약관에 동의합니다
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
