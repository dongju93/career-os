import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/auth-store';
import { renderRoute } from '../test/test-utils';
import type { JobPostingDetail, JobPostingPage } from '../types/job-posting';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function apiResponse<T>(data: T, status = 200) {
  return {
    status,
    message: 'ok',
    data,
  };
}

const TEST_GROUP_ID = '00000000-0000-7000-8000-000000000001';

const emptyGroupsResponse = {
  status: 200,
  message: 'ok',
  data: { items: [], total: 0, offset: 0, limit: 50 },
};

function buildJobPostingDetail(
  overrides: Partial<JobPostingDetail> = {},
): JobPostingDetail {
  return {
    id: 1,
    platform: 'wanted',
    posting_id: 'wd-1',
    posting_url: 'https://www.wanted.co.kr/wd/1',
    company_name: 'Career OS',
    job_title: 'Frontend Engineer',
    experience_req: '3년 이상',
    deadline: '상시',
    location: '서울',
    employment_type: '정규직',
    salary: '면접 후 결정',
    tech_stack: ['React', 'TypeScript'],
    tags: ['frontend'],
    job_category: 'Engineering',
    industry: 'Software',
    group_id: TEST_GROUP_ID,
    application_status: 'saved',
    status_updated_at: null,
    scraped_at: '2026-04-20T12:00:00Z',
    created_at: '2026-04-20T12:00:00Z',
    updated_at: '2026-04-20T12:00:00Z',
    job_description: 'Frontend product work',
    responsibilities: 'Build user-facing workflows',
    qualifications: 'React experience',
    preferred_points: 'Testing Library experience',
    benefits: 'Flexible work',
    hiring_process: 'Screening > Interview',
    education_req: '무관',
    application_method: 'Online',
    application_form: 'Resume',
    contact_person: 'Hiring Team',
    homepage: 'https://career-os.example.com',
    ...overrides,
  };
}

function buildJobPostingPage(detail = buildJobPostingDetail()): JobPostingPage {
  return {
    items: [
      {
        id: detail.id,
        platform: detail.platform,
        posting_id: detail.posting_id,
        posting_url: detail.posting_url,
        company_name: detail.company_name,
        job_title: detail.job_title,
        experience_req: detail.experience_req,
        deadline: detail.deadline,
        location: detail.location,
        employment_type: detail.employment_type,
        salary: detail.salary,
        tech_stack: detail.tech_stack,
        tags: detail.tags,
        job_category: detail.job_category,
        industry: detail.industry,
        group_id: detail.group_id,
        application_status: detail.application_status,
        status_updated_at: detail.status_updated_at,
        scraped_at: detail.scraped_at,
        created_at: detail.created_at,
        updated_at: detail.updated_at,
      },
    ],
    total: 1,
    offset: 0,
    limit: 50,
  };
}

describe('JobPostingDetailPage', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Career OS User',
      picture: null,
    });
  });

  it('loads a stored posting detail with the session cookie and renders all populated sections', async () => {
    const detail = buildJobPostingDetail();
    const fetchMock = vi.fn(async (input: string) => {
      if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
        return jsonResponse(
          apiResponse({
            user_id: 'user-1',
            email: 'user@example.com',
            name: 'Career OS User',
            picture: null,
          }),
        );
      }
      return jsonResponse(apiResponse(detail));
    });

    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/job-postings/1');

    expect(
      await screen.findByRole('heading', { name: 'Frontend Engineer' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getByText('Career OS'),
    ).toBeInTheDocument();
    expect(screen.getByText('서울')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Frontend product work')).toBeInTheDocument();
    expect(screen.getByText('Build user-facing workflows')).toBeInTheDocument();
    expect(screen.getByText('Testing Library experience')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /원본 공고 보기/i }),
    ).toHaveAttribute('href', 'https://www.wanted.co.kr/wd/1');
    expect(
      screen.getByRole('link', { name: /career-os\.example\.com/i }),
    ).toHaveAttribute('href', 'https://career-os.example.com');
    expect(fetchMock).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings/1`,
      expect.objectContaining({
        credentials: 'include',
        headers: { 'X-Career-OS-Client': 'web' },
      }),
    );
  });

  it('opens detail view when the list card is clicked', async () => {
    const user = userEvent.setup();
    const detail = buildJobPostingDetail();
    const fetchMock = vi.fn(async (input: string) => {
      if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
        return jsonResponse(
          apiResponse({
            user_id: 'user-1',
            email: 'user@example.com',
            name: 'Career OS User',
            picture: null,
          }),
        );
      }

      if (
        (input as string).startsWith(
          `${import.meta.env.VITE_API_BASE_URL}/v1/job-search-groups`,
        )
      ) {
        return jsonResponse(emptyGroupsResponse);
      }

      if (
        input ===
        `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings?offset=0&limit=50`
      ) {
        return jsonResponse(apiResponse(buildJobPostingPage(detail)));
      }

      if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings/1`) {
        return jsonResponse(apiResponse(detail));
      }

      throw new Error(`Unexpected fetch request: ${input}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { router } = renderRoute('/job-postings');

    await user.click(
      await screen.findByRole('link', { name: 'Frontend Engineer' }),
    );

    expect(router.state.location.pathname).toBe('/job-postings/1');
    expect(
      await screen.findByRole('heading', { name: 'Frontend Engineer' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings/1`,
      expect.objectContaining({
        credentials: 'include',
        headers: { 'X-Career-OS-Client': 'web' },
      }),
    );
  });

  it('opens detail view when the card link is activated by keyboard', async () => {
    const user = userEvent.setup();
    const detail = buildJobPostingDetail();
    const fetchMock = vi.fn(async (input: string) => {
      if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
        return jsonResponse(
          apiResponse({
            user_id: 'user-1',
            email: 'user@example.com',
            name: 'Career OS User',
            picture: null,
          }),
        );
      }

      if (
        (input as string).startsWith(
          `${import.meta.env.VITE_API_BASE_URL}/v1/job-search-groups`,
        )
      ) {
        return jsonResponse(emptyGroupsResponse);
      }

      if (
        input ===
        `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings?offset=0&limit=50`
      ) {
        return jsonResponse(apiResponse(buildJobPostingPage(detail)));
      }

      if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings/1`) {
        return jsonResponse(apiResponse(detail));
      }

      throw new Error(`Unexpected fetch request: ${input}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { router } = renderRoute('/job-postings');

    const cardLink = await screen.findByRole('link', {
      name: 'Frontend Engineer',
    });
    cardLink.focus();
    await user.keyboard('{Enter}');

    expect(router.state.location.pathname).toBe('/job-postings/1');
  });

  it('changes application status via the selector and reflects the server response', async () => {
    const user = userEvent.setup();
    const detail = buildJobPostingDetail();
    let patchBody: Record<string, unknown> | null = null;

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
        return jsonResponse(
          apiResponse({
            user_id: 'user-1',
            email: 'user@example.com',
            name: 'Career OS User',
            picture: null,
          }),
        );
      }

      if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings/1`) {
        if (init?.method === 'PATCH') {
          patchBody = JSON.parse(String(init.body)) as Record<string, unknown>;
          return jsonResponse(
            apiResponse({
              ...detail,
              application_status: 'interviewing',
              status_updated_at: '2026-04-25T09:00:00Z',
            }),
          );
        }
        return jsonResponse(apiResponse(detail));
      }

      throw new Error(`Unexpected fetch request: ${input}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/job-postings/1');

    await screen.findByRole('heading', { name: 'Frontend Engineer' });

    const statusSelect =
      screen.getByLabelText<HTMLSelectElement>('지원 상태 변경');
    expect(statusSelect.value).toBe('saved');

    await user.selectOptions(statusSelect, 'interviewing');

    await waitFor(() => {
      expect(patchBody).toEqual({ application_status: 'interviewing' });
    });
    await waitFor(() => {
      expect(statusSelect.value).toBe('interviewing');
    });
  });

  it('surfaces a failure when the status update is rejected', async () => {
    const user = userEvent.setup();
    const detail = buildJobPostingDetail();

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
        return jsonResponse(
          apiResponse({
            user_id: 'user-1',
            email: 'user@example.com',
            name: 'Career OS User',
            picture: null,
          }),
        );
      }

      if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings/1`) {
        if (init?.method === 'PATCH') {
          return jsonResponse(
            {
              type: 'about:blank',
              title: 'Unprocessable Entity',
              status: 422,
              detail: '상태 값이 올바르지 않습니다.',
              instance: '/v1/job-postings/1',
            },
            422,
          );
        }
        return jsonResponse(apiResponse(detail));
      }

      throw new Error(`Unexpected fetch request: ${input}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/job-postings/1');

    await screen.findByRole('heading', { name: 'Frontend Engineer' });

    const statusSelect =
      screen.getByLabelText<HTMLSelectElement>('지원 상태 변경');
    await user.selectOptions(statusSelect, 'applied');

    expect(
      await screen.findByText('상태 값이 올바르지 않습니다.'),
    ).toBeInTheDocument();
    // No optimistic write: the controlled selector reverts to the server value.
    expect(statusSelect.value).toBe('saved');
  });

  it('shows a structured API error and retries the same detail request', async () => {
    const user = userEvent.setup();
    const detail = buildJobPostingDetail();
    let detailRequestCount = 0;
    const fetchMock = vi.fn(async (input: string) => {
      if (input === `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`) {
        return jsonResponse(
          apiResponse({
            user_id: 'user-1',
            email: 'user@example.com',
            name: 'Career OS User',
            picture: null,
          }),
        );
      }

      if (input !== `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings/1`) {
        throw new Error(`Unexpected fetch request: ${input}`);
      }

      detailRequestCount += 1;

      if (detailRequestCount === 1) {
        return jsonResponse(
          {
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: '저장된 채용공고를 찾을 수 없습니다.',
            instance: '/v1/job-postings/1',
          },
          404,
        );
      }

      return jsonResponse(apiResponse(detail));
    });

    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/job-postings/1');

    expect(
      await screen.findByRole('heading', {
        name: /채용공고를 불러오지 못했습니다/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('저장된 채용공고를 찾을 수 없습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByText('UNKNOWN_API_ERROR')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /다시 시도/i }));

    expect(
      await screen.findByRole('heading', { name: 'Frontend Engineer' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
