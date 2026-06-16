import { describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '../types/user-profile';
import { ApiError, CLIENT_CONTRACT_MISMATCH } from './api-error';
import { fetchUserProfile, saveUserProfile } from './user-profile';

function okResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function apiResponse<T>(data: T) {
  return { status: 200, message: 'ok', data };
}

const sampleProfile: UserProfile = {
  headline: '5년 차 백엔드 엔지니어',
  years_experience: 5,
  target_roles: ['Backend Engineer'],
  skills: ['Python', 'PostgreSQL'],
  locations: ['서울'],
  salary_expectation: '6,000만원 이상',
  summary: 'FastAPI 기반 서비스 개발 경험',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

describe('fetchUserProfile', () => {
  it('returns the profile on a valid response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse(apiResponse(sampleProfile))),
    );

    const result = await fetchUserProfile();

    expect(result).not.toBeNull();
    expect(result?.headline).toBe('5년 차 백엔드 엔지니어');
    expect(result?.years_experience).toBe(5);
  });

  it('returns null when the profile does not exist yet (404)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse(
        {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: '프로필이 아직 없습니다.',
          instance: '/v1/profile',
        },
        404,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchUserProfile();

    expect(result).toBeNull();
    // 404 is not retried — a single request only.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError with CLIENT_CONTRACT_MISMATCH on schema mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          okResponse({ status: 200, message: 'ok', data: { headline: 5 } }),
        ),
    );

    await expect(fetchUserProfile()).rejects.toMatchObject({
      code: CLIENT_CONTRACT_MISMATCH,
    });
    await expect(fetchUserProfile()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('saveUserProfile', () => {
  it('sends a PUT to /v1/profile with the upsert body as JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse(apiResponse(sampleProfile)));
    vi.stubGlobal('fetch', fetchMock);

    const upsert = {
      headline: '5년 차 백엔드 엔지니어',
      years_experience: 5,
      target_roles: ['Backend Engineer'],
      skills: ['Python', 'PostgreSQL'],
      locations: ['서울'],
      salary_expectation: '6,000만원 이상',
      summary: 'FastAPI 기반 서비스 개발 경험',
    };
    const result = await saveUserProfile(upsert);

    expect(result.headline).toBe('5년 차 백엔드 엔지니어');
    expect(fetchMock).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_BASE_URL}/v1/profile`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(upsert),
      }),
    );
    // Single-attempt: a PUT must not be retried.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError with CLIENT_CONTRACT_MISMATCH on schema mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          okResponse({ status: 200, message: 'ok', data: {} }),
        ),
    );

    await expect(
      saveUserProfile({
        headline: null,
        years_experience: null,
        target_roles: null,
        skills: null,
        locations: null,
        salary_expectation: null,
        summary: null,
      }),
    ).rejects.toMatchObject({ code: CLIENT_CONTRACT_MISMATCH });
  });
});
