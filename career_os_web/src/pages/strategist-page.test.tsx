import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/auth-store';
import { renderRoute } from '../test/test-utils';
import type { ApplicationPlan } from '../types/application-plan';
import type { JobSearchGroupItem } from '../types/job-search-group';
import type { UserProfile } from '../types/user-profile';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  };
}

function apiResponse<T>(data: T) {
  return { status: 200, message: 'ok', data };
}

const BASE = import.meta.env.VITE_API_BASE_URL;

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

const activeGroup: JobSearchGroupItem = {
  id: '00000000-0000-7000-8000-000000000001',
  name: '2026년 상반기 취업',
  started_at: '2026-01-01',
  ended_at: null,
  memo: null,
  posting_count: 3,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const samplePlan: ApplicationPlan = {
  summary: '백엔드 직무 위주로 정리한 지원 전략입니다.',
  items: [
    {
      job_id: 12,
      company_name: '토스',
      job_title: '백엔드 엔지니어',
      fit_score: 82,
      matched_skills: ['Python', 'PostgreSQL'],
      missing_skills: ['Go'],
      deadline_urgency: 'soon',
      recommended_action: '이번 주 안에 지원서를 제출하세요.',
      rationale: '기술 스택이 잘 맞고 마감이 임박했습니다.',
    },
  ],
};

const emptyPlan: ApplicationPlan = {
  summary: '저장된 공고가 없어 분석할 항목이 없습니다.',
  items: [],
};

// Builds a global fetch stub that always satisfies ProtectedRoute's /v1/auth/me
// and the bootstrap calls (profile + groups), then delegates POST /v1/agent/plan
// to the per-test `planHandler`.
function makeFetchMock(options: {
  profile: UserProfile | 'notfound';
  groups: JobSearchGroupItem[];
  planHandler?: (init?: RequestInit) => ReturnType<typeof jsonResponse>;
}) {
  return vi.fn(async (input: string, init?: RequestInit) => {
    if (input === `${BASE}/v1/auth/me`) {
      return jsonResponse(authMeBody);
    }
    if (input === `${BASE}/v1/profile`) {
      return options.profile === 'notfound'
        ? jsonResponse(profileNotFound, 404)
        : jsonResponse(apiResponse(options.profile));
    }
    if (input.includes('/v1/job-search-groups')) {
      return jsonResponse(
        apiResponse({
          items: options.groups,
          total: options.groups.length,
          offset: 0,
          limit: 100,
        }),
      );
    }
    if (input === `${BASE}/v1/agent/plan` && init?.method === 'POST') {
      if (!options.planHandler) throw new Error('unexpected plan call');
      return options.planHandler(init);
    }
    throw new Error(`Unexpected fetch: ${input}`);
  });
}

describe('StrategistPage', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Career OS User',
      picture: null,
    });
  });

  it('shows the profile CTA and hides the form when no profile exists', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ profile: 'notfound', groups: [] }));

    renderRoute('/strategist');

    expect(
      await screen.findByText(
        '지원 전략 플랜을 만들려면 먼저 프로필을 작성해주세요.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '플랜 생성' }),
    ).not.toBeInTheDocument();
  });

  it('generates a plan and renders prioritized items', async () => {
    const user = userEvent.setup();
    let planBody: Record<string, unknown> | null = null;

    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        profile: existingProfile,
        groups: [activeGroup],
        planHandler: (init) => {
          planBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
          return jsonResponse(apiResponse(samplePlan));
        },
      }),
    );

    renderRoute('/strategist');

    await user.click(await screen.findByRole('button', { name: '플랜 생성' }));

    expect(
      await screen.findByText('백엔드 직무 위주로 정리한 지원 전략입니다.'),
    ).toBeInTheDocument();
    expect(screen.getByText('백엔드 엔지니어')).toBeInTheDocument();
    expect(screen.getByText('토스')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(
      screen.getByText('이번 주 안에 지원서를 제출하세요.'),
    ).toBeInTheDocument();
    // Auto group + no focus → both sent as null.
    expect(planBody).toEqual({ group_id: null, focus: null });
  });

  it('shows the empty-postings message when the plan has no items', async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        profile: existingProfile,
        groups: [activeGroup],
        planHandler: () => jsonResponse(apiResponse(emptyPlan)),
      }),
    );

    renderRoute('/strategist');

    await user.click(await screen.findByRole('button', { name: '플랜 생성' }));

    expect(
      await screen.findByText(
        '분석할 저장 공고가 없습니다. 먼저 채용 공고를 저장해주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the "준비 중" state and hides the form on a 404 (feature flag off)', async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        profile: existingProfile,
        groups: [activeGroup],
        planHandler: () =>
          jsonResponse(
            {
              type: 'about:blank',
              title: 'Not Found',
              status: 404,
              detail: '기능이 비활성화되어 있습니다.',
              instance: '/v1/agent/plan',
            },
            404,
          ),
      }),
    );

    renderRoute('/strategist');

    await user.click(await screen.findByRole('button', { name: '플랜 생성' }));

    expect(
      await screen.findByText('아직 준비 중인 기능이에요.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '플랜 생성' }),
    ).not.toBeInTheDocument();
  });

  it('surfaces a failure with a manual retry button on a server error', async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        profile: existingProfile,
        groups: [activeGroup],
        planHandler: () =>
          jsonResponse(
            {
              type: 'about:blank',
              title: 'Internal Server Error',
              status: 500,
              detail: '일시적인 오류가 발생했습니다.',
              instance: '/v1/agent/plan',
            },
            500,
          ),
      }),
    );

    renderRoute('/strategist');

    await user.click(await screen.findByRole('button', { name: '플랜 생성' }));

    expect(
      await screen.findByText('일시적인 오류가 발생했습니다.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument();
  });
});
