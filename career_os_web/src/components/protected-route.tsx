import * as stylex from '@stylexjs/stylex';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from '@/styles/motion';
import { fetchAuthMe } from '../services/auth';
import { resetAuthStore, useAuthStore } from '../store/auth-store';
import {
  buildLoginPath,
  getRedirectPathFromLocation,
} from '../utils/auth-redirect';

function SessionCheckShell() {
  return (
    <main
      aria-busy="true"
      aria-labelledby="session-check-title"
      {...stylex.props(styles.sessionCheckShellMain)}
    >
      <div
        aria-hidden="true"
        {...stylex.props(styles.sessionCheckShellContainer)}
      />
      <div
        aria-hidden="true"
        {...stylex.props(styles.sessionCheckShellContainer2)}
      />

      <Card xstyle={[styles.sessionCheckShellCard, motion.fadeIn]}>
        <CardContent xstyle={styles.sessionCheckShellCardContent}>
          <div {...stylex.props(styles.sessionCheckShellRow)}>
            <div {...stylex.props(styles.sessionCheckShellContainer3)} />
            <Loader2
              aria-hidden="true"
              {...stylex.props([styles.sessionCheckShellLoader2, motion.spin])}
            />
          </div>
          <div>
            <h1
              {...stylex.props(styles.sessionCheckShellHeading)}
              id="session-check-title"
            >
              인증 확인 중
            </h1>
            <p {...stylex.props(styles.sessionCheckShellDescription)}>
              안전하게 계정 정보를 확인하고 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export function ProtectedRoute() {
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const location = useLocation();
  const [hasCheckedSession, setHasCheckedSession] = useState(false);

  useEffect(() => {
    let isActive = true;

    fetchAuthMe()
      .then((data) => {
        if (!isActive) return;
        setAuth({
          id: data.user_id,
          email: data.email,
          name: data.name,
          picture: data.picture,
        });
        setHasCheckedSession(true);
      })
      .catch(() => {
        if (!isActive) return;
        resetAuthStore();
        setHasCheckedSession(true);
      });

    return () => {
      isActive = false;
    };
  }, [setAuth]);

  if (!user && !hasCheckedSession) {
    return <SessionCheckShell />;
  }

  if (!user) {
    return (
      <Navigate
        replace
        to={buildLoginPath(getRedirectPathFromLocation(location))}
      />
    );
  }

  return <Outlet />;
}

const styles = stylex.create({
  sessionCheckShellMain: {
    position: 'relative',
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingLeft: '1rem',
    paddingRight: '1rem',
  },
  sessionCheckShellContainer: {
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
  sessionCheckShellContainer2: {
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
  sessionCheckShellCard: {
    width: '100%',
    maxWidth: '24rem',
    animationName: {
      default: null,
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  sessionCheckShellCardContent: {
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
  sessionCheckShellRow: {
    position: 'relative',
    display: 'flex',
    height: '4.5rem',
    width: '4.5rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, hsl(var(--primary)) 20%, transparent)',
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 10%, transparent)',
  },
  sessionCheckShellContainer3: {
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
  sessionCheckShellLoader2: {
    position: 'relative',
    zIndex: 10,
    height: '2.5rem',
    width: '2.5rem',
    color: 'hsl(var(--primary))',
    animationName: {
      default: null,
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  sessionCheckShellHeading: {
    fontSize: '1.125rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  sessionCheckShellDescription: {
    marginTop: '0.25rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
});
