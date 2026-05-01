import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildGoogleLoginUrl,
  buildLoginPath,
  consumeStoredRedirectPath,
  getSafeRedirectPath,
  readStoredRedirectPath,
  storeRedirectPath,
} from './auth-redirect';

const SESSION_KEY = 'career-os-auth-return-to';

describe('getSafeRedirectPath', () => {
  it('returns / for null', () => {
    expect(getSafeRedirectPath(null)).toBe('/');
  });

  it('returns / for undefined', () => {
    expect(getSafeRedirectPath(undefined)).toBe('/');
  });

  it('returns / for empty string', () => {
    expect(getSafeRedirectPath('')).toBe('/');
  });

  it('returns / for protocol-relative paths (open-redirect guard)', () => {
    expect(getSafeRedirectPath('//evil.com')).toBe('/');
  });

  it('returns / for absolute URLs', () => {
    expect(getSafeRedirectPath('https://evil.com/steal')).toBe('/');
  });

  it('returns / for /login', () => {
    expect(getSafeRedirectPath('/login')).toBe('/');
  });

  it('returns / for /login with query params', () => {
    expect(getSafeRedirectPath('/login?next=%2F')).toBe('/');
  });

  it('returns / for /auth/callback', () => {
    expect(getSafeRedirectPath('/auth/callback')).toBe('/');
  });

  it('passes through safe app paths unchanged', () => {
    expect(getSafeRedirectPath('/job-postings')).toBe('/job-postings');
    expect(getSafeRedirectPath('/job-postings?offset=50')).toBe(
      '/job-postings?offset=50',
    );
    expect(getSafeRedirectPath('/job-postings/1')).toBe('/job-postings/1');
  });
});

describe('buildLoginPath', () => {
  it('returns /login with no params for root next path', () => {
    expect(buildLoginPath('/')).toBe('/login');
  });

  it('includes next param for non-root paths', () => {
    expect(buildLoginPath('/job-postings')).toBe('/login?next=%2Fjob-postings');
  });

  it('includes error param when provided', () => {
    expect(buildLoginPath('/', { error: 'auth_failed' })).toBe(
      '/login?error=auth_failed',
    );
  });

  it('includes both next and error params', () => {
    expect(buildLoginPath('/job-postings', { error: 'auth_failed' })).toBe(
      '/login?next=%2Fjob-postings&error=auth_failed',
    );
  });

  it('sanitizes an unsafe next path before building the login URL', () => {
    expect(buildLoginPath('//evil.com')).toBe('/login');
    expect(buildLoginPath('/login')).toBe('/login');
  });
});

describe('buildGoogleLoginUrl', () => {
  it('constructs the OAuth URL with the correct callback', () => {
    expect(
      buildGoogleLoginUrl('https://api.example.com', 'https://app.example.com'),
    ).toBe(
      'https://api.example.com/v1/auth/google?callback_url=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback',
    );
  });
});

describe('storeRedirectPath', () => {
  beforeEach(() => sessionStorage.removeItem(SESSION_KEY));
  afterEach(() => sessionStorage.removeItem(SESSION_KEY));

  it('stores a valid path in sessionStorage', () => {
    storeRedirectPath('/job-postings');
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('/job-postings');
  });

  it('removes the key when the path resolves to root', () => {
    sessionStorage.setItem(SESSION_KEY, '/job-postings');
    storeRedirectPath('/');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('does not store auth pages', () => {
    storeRedirectPath('/login');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();

    storeRedirectPath('/auth/callback');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('readStoredRedirectPath', () => {
  beforeEach(() => sessionStorage.removeItem(SESSION_KEY));

  it('returns the fallback when nothing is stored', () => {
    expect(readStoredRedirectPath('/fallback')).toBe('/fallback');
  });

  it('returns / as the default fallback', () => {
    expect(readStoredRedirectPath()).toBe('/');
  });

  it('returns the stored path when present', () => {
    sessionStorage.setItem(SESSION_KEY, '/job-postings');
    expect(readStoredRedirectPath()).toBe('/job-postings');
  });
});

describe('consumeStoredRedirectPath', () => {
  beforeEach(() => sessionStorage.removeItem(SESSION_KEY));

  it('reads the stored path and removes it from sessionStorage', () => {
    sessionStorage.setItem(SESSION_KEY, '/job-postings');

    const result = consumeStoredRedirectPath();

    expect(result).toBe('/job-postings');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('returns the fallback and leaves sessionStorage empty', () => {
    const result = consumeStoredRedirectPath('/fallback');

    expect(result).toBe('/fallback');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
