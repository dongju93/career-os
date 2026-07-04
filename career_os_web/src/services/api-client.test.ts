import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchWithApiRetry,
  setAccessToken,
  withCareerOsSessionHeaders,
} from './api-client';

const ACCESS_TOKEN_STORAGE_KEY = 'career-os-access-token';

function okResponse(body: unknown = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function errorResponse(
  status: number,
  body: unknown = {},
  headers?: HeadersInit,
) {
  return {
    ok: false,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as unknown as Response;
}

describe('fetchWithApiRetry', () => {
  it('returns the response immediately on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithApiRetry('/test', undefined, 'failed');

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('adds credentials and X-Career-OS-Client header with plain-object headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithApiRetry(
      '/test',
      { headers: { 'Content-Type': 'application/json' } },
      'failed',
    );

    expect(fetchMock).toHaveBeenCalledWith('/test', {
      credentials: 'include',
      headers: {
        'X-Career-OS-Client': 'web',
        'Content-Type': 'application/json',
      },
    });
  });

  it('merges Headers instance with the session client header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const headers = new Headers({ Authorization: 'Bearer token' });
    await fetchWithApiRetry('/test', { headers }, 'failed');

    const passedHeaders: Headers = fetchMock.mock.calls[0][1].headers;
    expect(passedHeaders).toBeInstanceOf(Headers);
    expect(passedHeaders.get('X-Career-OS-Client')).toBe('web');
    expect(passedHeaders.get('Authorization')).toBe('Bearer token');
  });

  it('merges array-form headers with the session client header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const headers: [string, string][] = [['Content-Type', 'application/json']];
    await fetchWithApiRetry('/test', { headers }, 'failed');

    const passedHeaders: Headers = fetchMock.mock.calls[0][1].headers;
    expect(passedHeaders).toBeInstanceOf(Headers);
    expect(passedHeaders.get('X-Career-OS-Client')).toBe('web');
    expect(passedHeaders.get('Content-Type')).toBe('application/json');
  });

  it('retries up to 5 times on 5xx errors and then throws', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        errorResponse(503, { code: 'INTERNAL_SERVER_ERROR', message: 'down' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithApiRetry('/test', undefined, 'failed');
    // Suppress the unhandled-rejection warning that fires while timers are advancing;
    // expect().rejects below will still receive the rejection.
    promise.catch(() => {});

    // Advance through each exponential back-off delay: 500 → 1000 → 2000 → 4000
    for (const delay of [500, 1000, 2000, 4000]) {
      await vi.advanceTimersByTimeAsync(delay);
    }

    await expect(promise).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('does not retry on 4xx errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(errorResponse(404, { detail: 'not found' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithApiRetry('/test', undefined, 'failed'),
    ).rejects.toMatchObject({
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not retry 429 rate limit errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      errorResponse(
        429,
        { detail: '요청 한도를 초과했습니다. 8초 후에 다시 시도해주세요.' },
        {
          'RateLimit-Limit': '10',
          'RateLimit-Remaining': '0',
          'RateLimit-Reset': '1777777777',
          'Retry-After': '8',
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithApiRetry('/test', undefined, 'failed'),
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      message: '요청 한도를 초과했습니다. 8초 후에 다시 시도해주세요.',
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not retry a POST request by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithApiRetry('/test', { method: 'POST' }, 'failed'),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries a POST request when retryable is set to true', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(errorResponse(503, { code: 'INTERNAL_SERVER_ERROR' }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithApiRetry('/test', { method: 'POST' }, 'failed', {
      retryable: true,
    });
    promise.catch(() => {}); // suppress unhandled-rejection warning during timer advancement

    for (const delay of [500, 1000, 2000, 4000]) {
      await vi.advanceTimersByTimeAsync(delay);
    }

    await expect(promise).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('retries on a network TypeError and succeeds on the second attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(okResponse({ result: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithApiRetry('/test', undefined, 'failed');
    await vi.advanceTimersByTimeAsync(500);

    const res = await promise;
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on DATABASE_UNAVAILABLE code and succeeds on the second attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        errorResponse(503, {
          code: 'DATABASE_UNAVAILABLE',
          message: 'db unavailable',
        }),
      )
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithApiRetry('/test', undefined, 'failed');
    await vi.advanceTimersByTimeAsync(500);

    const res = await promise;
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('withCareerOsSessionHeaders', () => {
  it('adds the session client header to plain-object headers', () => {
    expect(
      withCareerOsSessionHeaders({ 'Content-Type': 'application/json' }),
    ).toEqual({
      'X-Career-OS-Client': 'web',
      'Content-Type': 'application/json',
    });
  });

  it('adds the session client header when no headers are provided', () => {
    expect(withCareerOsSessionHeaders(undefined)).toEqual({
      'X-Career-OS-Client': 'web',
    });
  });

  it('merges a Headers instance', () => {
    const result = withCareerOsSessionHeaders(
      new Headers({ Authorization: 'Bearer token' }),
    );
    expect(result).toBeInstanceOf(Headers);
    expect((result as Headers).get('X-Career-OS-Client')).toBe('web');
    expect((result as Headers).get('Authorization')).toBe('Bearer token');
  });

  it('merges array-form headers', () => {
    const result = withCareerOsSessionHeaders([
      ['Content-Type', 'application/json'],
    ]);
    expect(result).toBeInstanceOf(Headers);
    expect((result as Headers).get('X-Career-OS-Client')).toBe('web');
    expect((result as Headers).get('Content-Type')).toBe('application/json');
  });
});

describe('access token persistence', () => {
  afterEach(() => {
    setAccessToken(null);
    vi.resetModules();
  });

  it('persists the token to localStorage and attaches it as a Bearer header', async () => {
    setAccessToken('login-token');
    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe(
      'login-token',
    );

    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    await fetchWithApiRetry('/test', undefined, 'failed');

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer login-token',
    });
  });

  it('clears the persisted token when set to null (logout)', () => {
    setAccessToken('login-token');
    setAccessToken(null);
    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('rehydrates a persisted token on module load so it survives a reload', async () => {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'persisted-token');
    vi.resetModules();
    const { fetchWithApiRetry: reloadedFetch } = await import('./api-client');

    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    await reloadedFetch('/test', undefined, 'failed');

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer persisted-token',
    });
  });
});
