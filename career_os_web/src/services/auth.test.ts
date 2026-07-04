import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from './api-client';
import { ApiError, CLIENT_CONTRACT_MISMATCH } from './api-error';
import { exchangeLoginCode, fetchAuthMe, logoutUser } from './auth';

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function apiResponse<T>(data: T) {
  return { status: 200, message: 'ok', data };
}

describe('logoutUser', () => {
  it('makes a POST to /v1/auth/logout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await logoutUser();

    expect(fetchMock).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_BASE_URL}/v1/auth/logout`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('fetchAuthMe', () => {
  it('returns the parsed user data on a valid response', async () => {
    const userData = {
      user_id: 'u1',
      email: 'u@example.com',
      name: 'Test User',
      picture: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse(apiResponse(userData))),
    );

    const result = await fetchAuthMe();

    expect(result).toEqual(userData);
  });

  it('throws ApiError with CLIENT_CONTRACT_MISMATCH when the response shape is wrong', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({
          status: 200,
          message: 'ok',
          data: { unexpected_field: true },
        }),
      ),
    );

    await expect(fetchAuthMe()).rejects.toMatchObject({
      code: CLIENT_CONTRACT_MISMATCH,
    });
    await expect(fetchAuthMe()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('exchangeLoginCode', () => {
  afterEach(() => {
    setAccessToken(null);
  });

  it('posts the code and attaches the returned token to later requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        okResponse(
          apiResponse({ access_token: 'tok-123', token_type: 'bearer' }),
        ),
      )
      .mockResolvedValueOnce(
        okResponse(
          apiResponse({
            user_id: 'u1',
            email: 'u@example.com',
            name: null,
            picture: null,
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await exchangeLoginCode('the-login-code');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${import.meta.env.VITE_API_BASE_URL}/v1/auth/token`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ login_code: 'the-login-code' }),
      }),
    );

    await fetchAuthMe();
    const [, secondCallInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const headers = new Headers(secondCallInit.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-123');
  });

  it('throws ApiError with CLIENT_CONTRACT_MISMATCH when the response shape is wrong', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({
          status: 200,
          message: 'ok',
          data: { unexpected_field: true },
        }),
      ),
    );

    await expect(exchangeLoginCode('bad-response-code')).rejects.toMatchObject({
      code: CLIENT_CONTRACT_MISMATCH,
    });
  });
});
