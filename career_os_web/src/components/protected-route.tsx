import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { fetchAuthMe } from '../services/auth';
import { resetAuthStore, useAuthStore } from '../store/auth-store';
import {
  buildLoginPath,
  getRedirectPathFromLocation,
} from '../utils/auth-redirect';

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
