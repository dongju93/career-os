import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
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
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-8rem] top-[-8rem] h-96 w-96 rounded-full bg-linear-to-br from-cyan-400/30 via-primary/15 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-6rem] left-[-5rem] h-72 w-72 rounded-full bg-linear-to-tr from-teal-400/25 via-primary/12 to-transparent blur-3xl"
      />

      <Card className="w-full max-w-sm animate-fade-in motion-reduce:animate-none">
        <CardContent className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-primary/20 bg-primary/10">
            <div className="absolute inset-2 rounded-full bg-linear-to-br from-primary/15 to-teal-500/12 blur-md" />
            <Loader2
              aria-hidden="true"
              className="relative z-10 h-10 w-10 animate-spin text-primary motion-reduce:animate-none"
            />
          </div>
          <div>
            <h1
              className="text-lg font-semibold tracking-tight"
              id="session-check-title"
            >
              인증 확인 중
            </h1>
            <p className="mt-1 text-sm text-gray-600">
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
