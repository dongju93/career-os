import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { API_BASE_URL } from '@/services/api-base-url';
import { useAuthStore } from '@/store/auth-store';
import {
  buildLoginPath,
  consumeStoredRedirectPath,
  getSafeRedirectPath,
  readStoredRedirectPath,
} from '@/utils/auth-redirect';

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
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-teal-500/20 blur-xl" />
          <Loader2 className="h-10 w-10 text-primary animate-spin relative" />
        </div>
        <p className="text-sm text-muted-foreground">Completing sign-in...</p>
      </div>
    </div>
  );
}
