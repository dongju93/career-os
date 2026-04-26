import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { fetchAuthMe } from '../services/auth';
import { useAuthStore } from '../store/auth-store';
import {
  buildLoginPath,
  getRedirectPathFromLocation,
} from '../utils/auth-redirect';

export function ProtectedRoute() {
  const user = useAuthStore((state) => state.user);
  const { clearAuth, setAuth } = useAuthStore();
  const location = useLocation();
  const [hasCheckedSession, setHasCheckedSession] = useState(Boolean(user));

  useEffect(() => {
    if (user) {
      setHasCheckedSession(true);
      return;
    }

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
        clearAuth();
        setHasCheckedSession(true);
      });

    return () => {
      isActive = false;
    };
  }, [user, setAuth, clearAuth]);

  if (!user && !hasCheckedSession) {
    return null;
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
