import * as stylex from '@stylexjs/stylex';
import { Briefcase, FolderOpen, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { motion } from '@/styles/motion';
import {
  DATABASE_UNAVAILABLE_CODE,
  INTERNAL_SERVER_ERROR_CODE,
} from '../services/api-error';
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

function getLoginErrorMessage(errorCode: string | null): string | null {
  if (!errorCode) return null;

  if (errorCode === 'auth_failed') {
    return '로그인에 실패했습니다. 다시 시도해주세요.';
  }

  if (errorCode === DATABASE_UNAVAILABLE_CODE) {
    return [
      '데이터베이스 연결이 일시적으로 불안정합니다.',
      '잠시 후 다시 시도해주세요. (DATABASE_UNAVAILABLE)',
    ].join(' ');
  }

  if (errorCode === INTERNAL_SERVER_ERROR_CODE) {
    return [
      '서버 오류가 발생했습니다.',
      '잠시 후 다시 시도해주세요. (INTERNAL_SERVER_ERROR)',
    ].join(' ');
  }

  return '예상치 못한 오류가 발생했습니다. 다시 시도해주세요.';
}

export function LoginPage() {
  useDocumentTitle('로그인');
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setError = useAuthStore((state) => state.setError);
  const setLoading = useAuthStore((state) => state.setLoading);
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get('error');
  const nextPath = getSafeRedirectPath(searchParams.get('next'));

  useEffect(() => {
    setError(getLoginErrorMessage(errorParam));
  }, [errorParam, setError]);

  if (user) {
    return (
      <Navigate replace to={nextPath === '/' ? '/job-postings' : nextPath} />
    );
  }

  function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    storeRedirectPath(nextPath);
    window.location.assign(
      buildGoogleLoginUrl(
        import.meta.env.VITE_API_BASE_URL,
        window.location.origin,
      ),
    );
  }

  return (
    <div {...stylex.props(styles.loginPageRow)}>
      {/* Vibrant ambient blobs behind the glass card */}
      <div aria-hidden="true" {...stylex.props(styles.loginPageContainer)} />
      <div aria-hidden="true" {...stylex.props(styles.loginPageContainer2)} />
      <div aria-hidden="true" {...stylex.props(styles.loginPageContainer3)} />

      {/* Single frosted glass card */}
      <Card xstyle={[styles.loginPageCard, motion.fadeIn]}>
        <CardContent xstyle={styles.loginPageCardContent}>
          <div {...stylex.props(styles.loginPageRow2)}>
            <span {...stylex.props(styles.loginPageText)}>구직 활동 관리</span>
            <div {...stylex.props(styles.loginPageRow3)}>CO</div>
            <div {...stylex.props(styles.loginPageContainer4)}>
              <h1 {...stylex.props(styles.loginPageHeading)}>Career OS</h1>
              <p {...stylex.props(styles.loginPageDescription)}>
                여러 채용공고를 한곳에 모아 정리하는 워크스페이스
              </p>
            </div>
          </div>

          {error && (
            <Alert xstyle={styles.loginPageAlert} variant="destructive">
              <AlertTitle>로그인 실패</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            xstyle={styles.loginPageButton}
            loading={isLoading}
            variant="glass"
            onClick={handleGoogleLogin}
          >
            {!isLoading && <GoogleIcon />}
            Google로 계속하기
          </Button>

          <div {...stylex.props(styles.loginPageStack)} data-stack="">
            {(
              [
                { icon: Briefcase, text: '채용공고 URL로 자동 스크랩 & 정리' },
                { icon: FolderOpen, text: '구직 활동 그룹으로 체계적 관리' },
                { icon: Sparkles, text: 'AI 기반 지원 전략 & 자료 생성' },
              ] as const
            ).map(({ icon: Icon, text }) => (
              <div key={text} {...stylex.props(styles.loginPageRow4)}>
                <div {...stylex.props(styles.loginPageRow5)}>
                  <Icon {...stylex.props(styles.loginPageIcon)} />
                </div>
                {text}
              </div>
            ))}
          </div>

          <p {...stylex.props(styles.loginPageDescription2)}>
            계속하면 서비스 이용약관에 동의하게 됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const styles = stylex.create({
  loginPageRow: {
    position: 'relative',
    isolation: 'isolate',
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    paddingTop: '2.5rem',
    paddingBottom: '2.5rem',
  },
  loginPageContainer: {
    pointerEvents: 'none',
    position: 'absolute',
    right: '-10rem',
    top: '-10rem',
    height: '28rem',
    width: '28rem',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, color-mix(in oklab, oklch(78.9% .154 211.53) 40%, transparent), color-mix(in oklab, hsl(var(--primary)) 25%, transparent), transparent)',
    filter: 'blur(64px)',
  },
  loginPageContainer2: {
    pointerEvents: 'none',
    position: 'absolute',
    bottom: '-8rem',
    left: '-6rem',
    height: '24rem',
    width: '24rem',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to top right in oklab, color-mix(in oklab, oklch(77.7% .152 181.912) 35%, transparent), color-mix(in oklab, hsl(var(--primary)) 20%, transparent), transparent)',
    filter: 'blur(64px)',
  },
  loginPageContainer3: {
    pointerEvents: 'none',
    position: 'absolute',
    top: '40%',
    left: '20%',
    height: '16rem',
    width: '16rem',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, color-mix(in oklab, oklch(62.7% .265 303.9) 30%, transparent), color-mix(in oklab, oklch(65.6% .241 354.308) 20%, transparent))',
    filter: 'blur(64px)',
  },
  loginPageCard: {
    marginLeft: '1rem',
    marginRight: '1rem',
    width: '100%',
    maxWidth: '28rem',
  },
  loginPageCardContent: {
    paddingLeft: '2rem',
    paddingRight: '2rem',
    paddingBottom: '2rem',
    paddingTop: '2rem',
  },
  loginPageRow2: {
    marginBottom: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  loginPageText: {
    borderRadius: '9999px',
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 15%, transparent)',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    paddingTop: '0.25rem',
    paddingBottom: '0.25rem',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.2em',
    color: 'hsl(var(--primary))',
    textTransform: 'uppercase',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, hsl(var(--primary)) 20%, transparent)',
  },
  loginPageRow3: {
    display: 'flex',
    height: '3.5rem',
    width: '3.5rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '1rem',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, hsl(var(--primary)), oklch(77.7% .152 181.912))',
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: 900,
    color: 'oklch(20.8% .042 265.755)',
    boxShadow:
      '0 10px 15px -3px color-mix(in oklab, hsl(var(--primary)) 30%, transparent), 0 4px 6px -4px color-mix(in oklab, hsl(var(--primary)) 30%, transparent)',
  },
  loginPageContainer4: {
    textAlign: 'center',
  },
  loginPageHeading: {
    fontSize: '1.875rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  loginPageDescription: {
    color: 'oklch(44.6% .03 256.802)',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: '0.25rem',
    maxWidth: '18rem',
    fontSize: '.875rem',
    lineHeight: '1.5rem',
    textWrap: 'balance',
  },
  loginPageAlert: {
    marginBottom: '1rem',
  },
  loginPageButton: {
    width: '100%',
    justifyContent: 'center',
  },
  loginPageStack: {
    marginTop: '1.25rem',
    '--stack-space': '0.625rem',
    borderRadius: '.75rem',
    backgroundColor: 'color-mix(in oklab, hsl(var(--muted)) 60%, transparent)',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    paddingTop: '0.875rem',
    paddingBottom: '0.875rem',
  },
  loginPageRow4: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  loginPageRow5: {
    display: 'flex',
    height: '1.25rem',
    width: '1.25rem',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 12%, transparent)',
    color: 'hsl(var(--primary))',
  },
  loginPageIcon: {
    height: '0.625rem',
    width: '0.625rem',
  },
  loginPageDescription2: {
    color: 'oklch(55.1% .027 264.364)',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: '1.25rem',
    maxWidth: '16rem',
    textAlign: 'center',
    fontSize: '.75rem',
    lineHeight: '1.25rem',
    textWrap: 'balance',
  },
});
