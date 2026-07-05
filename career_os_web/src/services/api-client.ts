import {
  ApiError,
  DATABASE_UNAVAILABLE_CODE,
  parseApiError,
} from './api-error';

const API_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 500;
const SESSION_CLIENT_HEADER = 'X-Career-OS-Client';
const SESSION_CLIENT_HEADER_VALUE = 'web';

const ACCESS_TOKEN_STORAGE_KEY = 'career-os-access-token';

// The Bearer token is the only credential that survives mobile third-party
// cookie blocking (Safari ITP, Chrome). It is obtained via POST /v1/auth/token
// right after login and MUST be persisted, not just held in memory: on those
// browsers a full page reload otherwise drops the token, /auth/me falls back to
// the blocked cross-site session cookie, 401s, and ProtectedRoute bounces the
// user to the login screen. Persisting it to localStorage lets the session
// survive a reload. Trade-off: a localStorage token is reachable by XSS — the
// SPA's standard defenses (React escaping, no untrusted dangerouslySetInnerHTML)
// are the mitigation, and the token is single-purpose with a fixed 7-day expiry.
function readPersistedAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token === null) {
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // Storage unavailable (private mode, quota): degrade to in-memory only.
    // Login still works within the tab; only cross-reload survival is lost.
  }
}

// Rehydrated from localStorage at module load so a reload keeps the token,
// then updated in lockstep with the persisted copy via setAccessToken.
let accessToken: string | null = readPersistedAccessToken();

export function setAccessToken(token: string | null) {
  accessToken = token;
  persistAccessToken(token);
}

export function withAccessTokenHeader(headers: HeadersInit | undefined) {
  if (!accessToken) return headers;

  if (headers instanceof Headers || Array.isArray(headers)) {
    const nextHeaders = new Headers(headers);
    if (!nextHeaders.has('Authorization')) {
      nextHeaders.set('Authorization', `Bearer ${accessToken}`);
    }
    return nextHeaders;
  }

  return { Authorization: `Bearer ${accessToken}`, ...headers };
}

function shouldRetry(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError &&
      (error.code === DATABASE_UNAVAILABLE_CODE || error.status >= 500))
  );
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function withCareerOsSessionHeaders(headers: HeadersInit | undefined) {
  if (headers instanceof Headers || Array.isArray(headers)) {
    const nextHeaders = new Headers(headers);
    nextHeaders.set(SESSION_CLIENT_HEADER, SESSION_CLIENT_HEADER_VALUE);
    return nextHeaders;
  }

  return {
    [SESSION_CLIENT_HEADER]: SESSION_CLIENT_HEADER_VALUE,
    ...headers,
  };
}

export type FetchWithRetryOptions = {
  retryable?: boolean;
};

export async function fetchWithApiRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackMessage: string,
  { retryable }: FetchWithRetryOptions = {},
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const maxAttempts = (retryable ?? method === 'GET') ? API_RETRY_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, {
        ...init,
        credentials: init?.credentials ?? 'include',
        headers: withCareerOsSessionHeaders(
          withAccessTokenHeader(init?.headers),
        ),
      });
      if (response.ok) return response;

      const apiError = await parseApiError(response, fallbackMessage);
      if (attempt < maxAttempts && shouldRetry(apiError)) {
        await sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      throw apiError;
    } catch (error) {
      if (attempt < maxAttempts && shouldRetry(error)) {
        await sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      throw error;
    }
  }

  throw new Error('unreachable');
}
