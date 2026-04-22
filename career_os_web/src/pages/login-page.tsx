import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Vibrant ambient blobs behind the glass card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-10rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-linear-to-br from-cyan-400/40 via-primary/25 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] h-96 w-96 rounded-full bg-linear-to-tr from-teal-400/35 via-primary/20 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[40%] left-[20%] h-64 w-64 rounded-full bg-linear-to-br from-purple-500/30 to-pink-500/20 blur-3xl"
      />

      {/* Single frosted glass card */}
      <Card className="mx-4 w-full max-w-md animate-fade-in">
        <CardContent className="px-8 pb-8 pt-8">
          <div className="mb-8 flex flex-col items-center gap-4">
            <span className="rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-primary uppercase border border-primary/20">
              Frosted Workspace
            </span>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-teal-400 text-lg font-black text-slate-900 shadow-lg shadow-primary/30">
              CO
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight">Career OS</h1>
              <p className="text-gray-600 mx-auto mt-1 max-w-[18rem] text-sm leading-6 text-balance">
                여러 채용공고를 한곳에 모아 정리하는 워크스페이스
              </p>
            </div>
          </div>

          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertTitle>로그인 실패</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full justify-center"
            loading={isLoading}
            variant="glass"
            onClick={handleGoogleLogin}
          >
            {!isLoading && <GoogleIcon />}
            Google로 계속하기
          </Button>

          <p className="text-gray-500 mx-auto mt-6 max-w-[16rem] text-center text-xs leading-5 text-balance">
            계속하면 서비스 이용약관에 동의하게 됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
