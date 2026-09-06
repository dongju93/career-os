import * as stylex from '@stylexjs/stylex';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { motion } from '@/styles/motion';
import { toUserFacingError } from '../services/api-error';
import { exchangeLoginCode, fetchAuthMe } from '../services/auth';
import { useAuthStore } from '../store/auth-store';
import {
  buildLoginPath,
  consumeStoredRedirectPath,
  getSafeRedirectPath,
  readStoredRedirectPath,
} from '../utils/auth-redirect';

export function AuthCallbackPage() {
  useDocumentTitle('로그인 처리 중');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth, setError, setLoading } = useAuthStore();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const oauthError = searchParams.get('error');
    const loginCode = searchParams.get('login_code');
    const rawNext = searchParams.get('next');
    const nextPath = readStoredRedirectPath(
      rawNext ? getSafeRedirectPath(rawNext) : '/job-postings',
    );

    window.history.replaceState({}, '', window.location.pathname);

    setLoading(true);

    if (oauthError) {
      setError('Google 로그인에 실패했습니다. 다시 시도해주세요.');
      navigate(buildLoginPath(nextPath, { error: 'auth_failed' }), {
        replace: true,
      });
      return;
    }

    // Best-effort: obtains a Bearer token so login still completes when the
    // session cookie was dropped in transit. If this fails, fetchAuthMe()
    // still succeeds normally whenever the cookie did survive.
    (loginCode
      ? exchangeLoginCode(loginCode).catch(() => undefined)
      : Promise.resolve()
    )
      .then(() => fetchAuthMe())
      .then((data) => {
        setAuth({
          id: data.user_id,
          email: data.email,
          name: data.name,
          picture: data.picture,
        });
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
    <div {...stylex.props(styles.authCallbackPageRow)}>
      <div
        aria-hidden="true"
        {...stylex.props(styles.authCallbackPageContainer)}
      />
      <div
        aria-hidden="true"
        {...stylex.props(styles.authCallbackPageContainer2)}
      />

      <Card xstyle={[styles.authCallbackPageCard, motion.fadeIn]}>
        <CardContent xstyle={styles.authCallbackPageCardContent}>
          <div {...stylex.props(styles.authCallbackPageRow2)}>
            <div {...stylex.props(styles.authCallbackPageContainer3)} />
            <Loader2
              {...stylex.props([styles.authCallbackPageLoader2, motion.spin])}
            />
          </div>
          <div>
            <p {...stylex.props(styles.authCallbackPageDescription)}>
              로그인 완료 중
            </p>
            <p {...stylex.props(styles.authCallbackPageDescription2)}>
              계정 정보를 확인한 뒤 작업 공간으로 이동합니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const styles = stylex.create({
  authCallbackPageRow: {
    position: 'relative',
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingLeft: '1rem',
    paddingRight: '1rem',
  },
  authCallbackPageContainer: {
    pointerEvents: 'none',
    position: 'absolute',
    right: '-8rem',
    top: '-8rem',
    height: '24rem',
    width: '24rem',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, color-mix(in oklab, oklch(78.9% .154 211.53) 30%, transparent), color-mix(in oklab, hsl(var(--primary)) 15%, transparent), transparent)',
    filter: 'blur(64px)',
  },
  authCallbackPageContainer2: {
    pointerEvents: 'none',
    position: 'absolute',
    bottom: '-6rem',
    left: '-5rem',
    height: '18rem',
    width: '18rem',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to top right in oklab, color-mix(in oklab, oklch(77.7% .152 181.912) 25%, transparent), color-mix(in oklab, hsl(var(--primary)) 12%, transparent), transparent)',
    filter: 'blur(64px)',
  },
  authCallbackPageCard: {
    width: '100%',
    maxWidth: '24rem',
  },
  authCallbackPageCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
    paddingLeft: '2rem',
    paddingRight: '2rem',
    paddingTop: '2.5rem',
    paddingBottom: '2.5rem',
    textAlign: 'center',
  },
  authCallbackPageRow2: {
    position: 'relative',
    display: 'flex',
    height: '4.5rem',
    width: '4.5rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 10%, transparent)',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, hsl(var(--primary)) 20%, transparent)',
  },
  authCallbackPageContainer3: {
    position: 'absolute',
    top: '0.5rem',
    bottom: '0.5rem',
    left: '0.5rem',
    right: '0.5rem',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, color-mix(in oklab, hsl(var(--primary)) 15%, transparent), color-mix(in oklab, oklch(70.4% .14 182.503) 12%, transparent))',
    filter: 'blur(12px)',
  },
  authCallbackPageLoader2: {
    position: 'relative',
    zIndex: 10,
    height: '2.5rem',
    width: '2.5rem',
    color: 'hsl(var(--primary))',
  },
  authCallbackPageDescription: {
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: 600,
    letterSpacing: '-.025em',
  },
  authCallbackPageDescription2: {
    marginTop: '0.25rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
});
