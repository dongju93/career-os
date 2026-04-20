const AUTH_RETURN_TO_STORAGE_KEY = 'career-os-auth-return-to';

type LocationLike = {
  hash: string;
  pathname: string;
  search: string;
};

type LoginPathOptions = {
  error?: string;
};

function isAuthPage(path: string) {
  return (
    path === '/login' || path.startsWith('/login?') || path === '/auth/callback'
  );
}

export function getSafeRedirectPath(candidate: string | null | undefined) {
  if (!candidate?.startsWith('/') || candidate.startsWith('//')) {
    return '/';
  }

  return isAuthPage(candidate) ? '/' : candidate;
}

export function getRedirectPathFromLocation(location: LocationLike) {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function buildLoginPath(
  nextPath: string,
  options: LoginPathOptions = {},
) {
  const safeNextPath = getSafeRedirectPath(nextPath);
  const params = new URLSearchParams();

  if (safeNextPath !== '/') {
    params.set('next', safeNextPath);
  }

  if (options.error) {
    params.set('error', options.error);
  }

  const query = params.toString();

  return query ? `/login?${query}` : '/login';
}

export function buildGoogleLoginUrl(apiBaseUrl: string, appOrigin: string) {
  const loginUrl = new URL('/v1/auth/google', apiBaseUrl);
  loginUrl.searchParams.set('callback_url', `${appOrigin}/auth/callback`);

  return loginUrl.toString();
}

export function readStoredRedirectPath(fallback = '/') {
  const storedPath = window.sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY);

  return storedPath ? getSafeRedirectPath(storedPath) : fallback;
}

export function storeRedirectPath(nextPath: string) {
  const safeNextPath = getSafeRedirectPath(nextPath);

  if (safeNextPath === '/') {
    window.sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, safeNextPath);
}

export function consumeStoredRedirectPath(fallback = '/') {
  const nextPath = readStoredRedirectPath(fallback);

  window.sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
  return nextPath;
}
