import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '@/store/auth-store';
import {
  buildLoginPath,
  getRedirectPathFromLocation,
} from '@/utils/auth-redirect';

export function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    return (
      <Navigate
        replace
        to={buildLoginPath(getRedirectPathFromLocation(location))}
      />
    );
  }

  return <Outlet />;
}
