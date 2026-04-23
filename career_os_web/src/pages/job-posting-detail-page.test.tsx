import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '../services/api-base-url';
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
    useAuthStore.getState().setAuth(
      {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Career OS User',
        picture: null,
      },
      'test-token',
    );
  });

  it('loads a stored posting detail with the bearer token and renders all populated sections', async () => {
    const detail = buildJobPostingDetail();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detail));

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
      `${API_BASE_URL}/v1/job-postings/1`,
      {
        headers: { Authorization: 'Bearer test-token' },
      },
    );
  });

  it('opens detail view when the list card is clicked', async () => {
    const user = userEvent.setup();
    const detail = buildJobPostingDetail();
    const fetchMock = vi.fn(async (input: string) => {
      if (input === `${API_BASE_URL}/v1/job-postings?offset=0&limit=50`) {
        return jsonResponse(buildJobPostingPage(detail));
      }

      if (input === `${API_BASE_URL}/v1/job-postings/1`) {
        return jsonResponse(detail);
      }

      throw new Error(`Unexpected fetch request: ${input}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { router } = renderRoute('/job-postings');

    await user.click(
      await screen.findByRole('heading', { name: 'Frontend Engineer' }),
    );

    expect(router.state.location.pathname).toBe('/job-postings/1');
    expect(
      await screen.findByRole('heading', { name: 'Frontend Engineer' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/v1/job-postings/1`,
      {
        headers: { Authorization: 'Bearer test-token' },
      },
    );
  });

  it('shows a structured API error and retries the same detail request', async () => {
    const user = userEvent.setup();
    const detail = buildJobPostingDetail();
    let detailRequestCount = 0;
    const fetchMock = vi.fn(async (input: string) => {
      if (input !== `${API_BASE_URL}/v1/job-postings/1`) {
        throw new Error(`Unexpected fetch request: ${input}`);
      }

      detailRequestCount += 1;

      if (detailRequestCount === 1) {
        return jsonResponse(
          {
            detail: {
              code: 'JOB_POSTING_NOT_FOUND',
              message: '저장된 채용공고를 찾을 수 없습니다.',
            },
          },
          404,
        );
      }

      return jsonResponse(detail);
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
    expect(screen.getByText('JOB_POSTING_NOT_FOUND')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /다시 시도/i }));

    expect(
      await screen.findByRole('heading', { name: 'Frontend Engineer' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
