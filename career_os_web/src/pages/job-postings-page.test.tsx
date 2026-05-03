import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/auth-store';
import { renderRoute } from '../test/test-utils';
import type { JobPostingPage } from '../types/job-posting';

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
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

const jobPostingPage: JobPostingPage = {
  items: [
    {
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
    },
  ],
  total: 1,
  offset: 0,
  limit: 50,
};

describe('JobPostingsPage', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Career OS User',
      picture: null,
    });
  });

  it('retries a rate-limited list request without passing the click event as fetch signal', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    const fetchMock = vi.fn(async (input: string, _init?: RequestInit) => {
      if (
        input !==
        `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings?offset=0&limit=50`
      ) {
        throw new Error(`Unexpected fetch request: ${input}`);
      }

      requestCount += 1;

      if (requestCount === 1) {
        return jsonResponse(
          { detail: '요청 한도를 초과했습니다. 8초 후에 다시 시도해주세요.' },
          429,
          {
            'RateLimit-Limit': '10',
            'RateLimit-Remaining': '0',
            'RateLimit-Reset': '1777777777',
            'Retry-After': '8',
          },
        );
      }

      return jsonResponse(apiResponse(jobPostingPage));
    });

    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/job-postings');

    expect(await screen.findByText('RATE_LIMIT_EXCEEDED')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /다시 시도/i }));

    expect(
      await screen.findByRole('heading', { name: 'Frontend Engineer' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.signal).toBeUndefined();
  });
});
