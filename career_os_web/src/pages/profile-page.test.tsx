import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/auth-store';
import { renderRoute } from '../test/test-utils';
import type { UserProfile } from '../types/user-profile';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function apiResponse<T>(data: T) {
  return { status: 200, message: 'ok', data };
}

const authMeBody = apiResponse({
  user_id: 'user-1',
  email: 'user@example.com',
  name: 'Career OS User',
  picture: null,
});

const profileNotFound = {
  type: 'about:blank',
  title: 'Not Found',
  status: 404,
  detail: '프로필이 아직 없습니다.',
  instance: '/v1/profile',
};

const existingProfile: UserProfile = {
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

const ONBOARDING_COPY = '프로필을 저장하면 AI 지원 전략 기능이 정확해져요.';

describe('ProfilePage', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Career OS User',
      picture: null,
    });
  });

  it('shows an empty form with onboarding copy when no profile exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
          return jsonResponse(authMeBody);
        }
        if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/profile`) {
          return jsonResponse(profileNotFound, 404);
        }
        throw new Error(`Unexpected fetch: ${input}`);
      }),
    );

    renderRoute('/profile');

    expect(await screen.findByText(ONBOARDING_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLInputElement>('한 줄 소개').value).toBe(
      '',
    );
  });

  it('prefills the form from an existing profile and hides onboarding copy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
          return jsonResponse(authMeBody);
        }
        if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/profile`) {
          return jsonResponse(apiResponse(existingProfile));
        }
        throw new Error(`Unexpected fetch: ${input}`);
      }),
    );

    renderRoute('/profile');

    expect(
      await screen.findByDisplayValue('5년 차 백엔드 엔지니어'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLInputElement>('경력 연차').value).toBe(
      '5',
    );
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.queryByText(ONBOARDING_COPY)).not.toBeInTheDocument();
  });

  it('saves the profile and shows a success message', async () => {
    const user = userEvent.setup();
    let putBody: Record<string, unknown> | null = null;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
          return jsonResponse(authMeBody);
        }
        if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/profile`) {
          if (init?.method === 'PUT') {
            putBody = JSON.parse(String(init.body)) as Record<string, unknown>;
            return jsonResponse(
              apiResponse({
                ...existingProfile,
                headline: '프론트엔드 엔지니어',
                years_experience: null,
                target_roles: null,
                skills: null,
                locations: null,
                salary_expectation: null,
                summary: null,
              }),
            );
          }
          return jsonResponse(profileNotFound, 404);
        }
        throw new Error(`Unexpected fetch: ${input}`);
      }),
    );

    renderRoute('/profile');

    const headline =
      await screen.findByLabelText<HTMLInputElement>('한 줄 소개');
    await user.type(headline, '프론트엔드 엔지니어');
    await user.click(screen.getByRole('button', { name: '프로필 저장' }));

    expect(
      await screen.findByText('프로필을 저장했습니다.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(putBody).toEqual({
        headline: '프론트엔드 엔지니어',
        years_experience: null,
        target_roles: null,
        skills: null,
        locations: null,
        salary_expectation: null,
        summary: null,
      });
    });
  });

  it('surfaces a failure message when saving fails', async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
          return jsonResponse(authMeBody);
        }
        if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/profile`) {
          if (init?.method === 'PUT') {
            return jsonResponse(
              {
                type: 'about:blank',
                title: 'Unprocessable Entity',
                status: 422,
                detail: '입력 값이 올바르지 않습니다.',
                instance: '/v1/profile',
              },
              422,
            );
          }
          return jsonResponse(apiResponse(existingProfile));
        }
        throw new Error(`Unexpected fetch: ${input}`);
      }),
    );

    renderRoute('/profile');

    await screen.findByDisplayValue('5년 차 백엔드 엔지니어');
    await user.click(screen.getByRole('button', { name: '프로필 저장' }));

    expect(
      await screen.findByText('입력 값이 올바르지 않습니다.'),
    ).toBeInTheDocument();
  });
});
