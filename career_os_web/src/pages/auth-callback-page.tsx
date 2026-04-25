import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { toUserFacingError } from '../services/api-error';
import { fetchAuthMe } from '../services/auth';
import { useAuthStore } from '../store/auth-store';
import {
  buildLoginPath,
  consumeStoredRedirectPath,
  getSafeRedirectPath,
  readStoredRedirectPath,
} from '../utils/auth-redirect';

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
    const rawNext = searchParams.get('next');
    const nextPath = readStoredRedirectPath(
      rawNext ? getSafeRedirectPath(rawNext) : '/job-postings',
    );

    window.history.replaceState({}, '', window.location.pathname);

    setLoading(true);

    if (oauthError || !accessToken) {
      setError('Google 로그인에 실패했습니다. 다시 시도해주세요.');
      navigate(buildLoginPath(nextPath, { error: 'auth_failed' }), {
        replace: true,
      });
      return;
    }

    fetchAuthMe(accessToken)
      .then((data) => {
        setAuth(
          {
            id: data.user_id,
            email: data.email,
            name: data.name,
            picture: data.picture,
          },
          accessToken,
        );
        navigate(consumeStoredRedirectPath(nextPath), { replace: true });
      })
      .catch((error: unknown) => {
        const userFacingError = toUserFacingError(
          error,
          '로그인 완료에 실패했습니다. 다시 시도해주세요.',
        );
        setError(`${userFacingError.message} (${userFacingError.code})`);
        navigate(buildLoginPath(nextPath, { error: userFacingError.code }), {
          replace: true,
        });
      });
  }, [navigate, searchParams, setAuth, setError, setLoading]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-8rem] top-[-8rem] h-96 w-96 rounded-full bg-linear-to-br from-cyan-400/30 via-primary/15 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-6rem] left-[-5rem] h-72 w-72 rounded-full bg-linear-to-tr from-teal-400/25 via-primary/12 to-transparent blur-3xl"
      />

      <Card className="w-full max-w-sm animate-fade-in">
        <CardContent className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <div className="absolute inset-2 rounded-full bg-linear-to-br from-primary/15 to-teal-500/12 blur-md" />
            <Loader2 className="relative z-10 h-10 w-10 animate-spin text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">
              로그인 완료 중
            </p>
            <p className="mt-1 text-sm text-gray-600">
              계정 정보를 확인한 뒤 작업 공간으로 이동합니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
