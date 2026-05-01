import { describe, expect, it } from 'vitest';
import {
  ApiError,
  INTERNAL_SERVER_ERROR_CODE,
  parseApiError,
  toUserFacingError,
  UNKNOWN_API_ERROR_CODE,
} from './api-error';

function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('ApiError', () => {
  it('constructs with the expected properties', () => {
    const err = new ApiError({
      code: 'MY_CODE',
      message: 'something failed',
      status: 422,
    });
    expect(err.code).toBe('MY_CODE');
    expect(err.message).toBe('something failed');
    expect(err.status).toBe(422);
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('parseApiError', () => {
  it('uses top-level code and message', async () => {
    const res = fakeResponse(400, { code: 'MY_CODE', message: '잘못된 요청' });
    const err = await parseApiError(res, 'fallback');
    expect(err.code).toBe('MY_CODE');
    expect(err.message).toBe('잘못된 요청');
    expect(err.status).toBe(400);
  });

  it('uses nested detail.code when top-level code is absent', async () => {
    const res = fakeResponse(422, {
      detail: { code: 'DETAIL_CODE', message: 'nested msg' },
    });
    const err = await parseApiError(res, 'fallback');
    expect(err.code).toBe('DETAIL_CODE');
    expect(err.message).toBe('nested msg');
  });

  it('uses detail string for message when detail is a plain string', async () => {
    const res = fakeResponse(404, { detail: '아이템을 찾을 수 없습니다' });
    const err = await parseApiError(res, 'fallback');
    expect(err.message).toBe('아이템을 찾을 수 없습니다');
    expect(err.code).toBe(UNKNOWN_API_ERROR_CODE);
  });

  it('defaults to INTERNAL_SERVER_ERROR_CODE for 5xx responses with no code', async () => {
    const res = fakeResponse(503, {});
    const err = await parseApiError(res, 'fallback message');
    expect(err.code).toBe(INTERNAL_SERVER_ERROR_CODE);
    expect(err.message).toBe('fallback message');
  });

  it('defaults to UNKNOWN_API_ERROR_CODE for 4xx responses with no code', async () => {
    const res = fakeResponse(400, {});
    const err = await parseApiError(res, 'fallback message');
    expect(err.code).toBe(UNKNOWN_API_ERROR_CODE);
    expect(err.message).toBe('fallback message');
  });

  it('uses fallback message and derived code when JSON parsing fails', async () => {
    const res = {
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as Response;
    const err = await parseApiError(res, 'fallback after parse error');
    expect(err.code).toBe(INTERNAL_SERVER_ERROR_CODE);
    expect(err.message).toBe('fallback after parse error');
  });
});

describe('toUserFacingError', () => {
  it('passes through ApiError code and message', () => {
    const err = new ApiError({
      code: 'MY_CODE',
      message: 'api error',
      status: 400,
    });
    expect(toUserFacingError(err, 'fallback')).toEqual({
      code: 'MY_CODE',
      message: 'api error',
    });
  });

  it('uses UNKNOWN_API_ERROR_CODE for a plain Error', () => {
    expect(
      toUserFacingError(new Error('plain error message'), 'fallback'),
    ).toEqual({
      code: UNKNOWN_API_ERROR_CODE,
      message: 'plain error message',
    });
  });

  it('uses fallback message for non-Error values', () => {
    expect(toUserFacingError('string error', 'fallback message')).toEqual({
      code: UNKNOWN_API_ERROR_CODE,
      message: 'fallback message',
    });
    expect(toUserFacingError(null, 'fallback message')).toEqual({
      code: UNKNOWN_API_ERROR_CODE,
      message: 'fallback message',
    });
    expect(toUserFacingError(42, 'fallback message')).toEqual({
      code: UNKNOWN_API_ERROR_CODE,
      message: 'fallback message',
    });
  });
});
