import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './store/auth-store';
import { renderRoute } from './test/test-utils';

const jobPostingPage = {
  items: [
    {
      id: 1,
      platform: 'wanted' as const,
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
    },
  ],
  total: 1,
  offset: 0,
  limit: 50,
};

describe('Career OS Web app shell', () => {
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

  it('redirects the root route to saved job postings and loads the page data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => jobPostingPage,
    });

    vi.stubGlobal('fetch', fetchMock);

    const { router } = renderRoute('/');

    expect(
      await screen.findByRole('heading', {
        name: /^채용공고$/i,
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/총 1개의 채용공고/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /frontend engineer/i }),
    ).toHaveAttribute('href', 'https://www.wanted.co.kr/wd/1');
    expect(router.state.location.pathname).toBe('/job-postings');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://career-os.fastapicloud.dev/v1/job-postings?offset=0&limit=50',
      {
        headers: { Authorization: 'Bearer test-token' },
      },
    );
  });

  it('logs the user out and returns to the login page', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({}),
        };
      }

      return {
        ok: true,
        json: async () => jobPostingPage,
      };
    });

    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/');

    await screen.findByRole('heading', { name: /^채용공고$/i });
    await user.click(screen.getByRole('button', { name: /로그아웃/i }));

    expect(
      await screen.findByRole('heading', {
        name: /^Career OS$/i,
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://career-os.fastapicloud.dev/v1/auth/logout',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      },
    );
    expect(useAuthStore.getState().token).toBeNull();
  });
});
