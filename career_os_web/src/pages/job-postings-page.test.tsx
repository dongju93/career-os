import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useAuthStore } from '../store/auth-store';
import { renderRoute } from '../test/test-utils';
import type { JobPostingPage } from '../types/job-posting';
import type { JobSearchGroupItem } from '../types/job-search-group';

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

const emptyGroupsResponse = {
  status: 200,
  message: 'ok',
  data: { items: [], total: 0, offset: 0, limit: 50 },
};

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
      group_id: '00000000-0000-7000-8000-000000000001',
      application_status: 'saved',
      status_updated_at: null,
      scraped_at: '2026-04-20T12:00:00Z',
      created_at: '2026-04-20T12:00:00Z',
      updated_at: '2026-04-20T12:00:00Z',
    },
  ],
  total: 1,
  offset: 0,
  limit: 50,
};

const GROUP_A_ID = '00000000-0000-7000-8000-00000000000a';
const GROUP_B_ID = '00000000-0000-7000-8000-00000000000b';

function buildGroup(id: string, name: string): JobSearchGroupItem {
  return {
    id,
    name,
    started_at: '2026-04-20',
    ended_at: null,
    memo: null,
    posting_count: 0,
    created_at: '2026-04-20T12:00:00Z',
    updated_at: '2026-04-20T12:00:00Z',
  };
}

function buildTitledPage(jobTitle: string): JobPostingPage {
  return {
    ...jobPostingPage,
    items: [{ ...jobPostingPage.items[0], job_title: jobTitle }],
  };
}

type PendingResponse = (response: ReturnType<typeof jsonResponse>) => void;

// Holds every postings request open, in arrival order per group, so a test
// decides exactly when each one settles. Like a response already in flight when
// the abort lands, these ignore the signal and can still resolve afterwards.
function stubDeferredPostingsFetch() {
  const pending: Record<string, PendingResponse[]> = {
    [GROUP_A_ID]: [],
    [GROUP_B_ID]: [],
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      if (input === `/v1/auth/me`) {
        return jsonResponse(
          apiResponse({
            user_id: 'user-1',
            email: 'user@example.com',
            name: 'Career OS User',
            picture: null,
          }),
        );
      }

      if (input.startsWith(`/v1/job-search-groups`)) {
        const items = [
          buildGroup(GROUP_A_ID, '그룹 A'),
          buildGroup(GROUP_B_ID, '그룹 B'),
        ];
        return jsonResponse(
          apiResponse({ items, total: items.length, offset: 0, limit: 50 }),
        );
      }

      const groupId = new URL(input, 'http://localhost').searchParams.get(
        'group_id',
      );
      if (groupId === null) {
        throw new Error(`Unexpected fetch request: ${input}`);
      }

      return new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
        pending[groupId].push(resolve);
      });
    }),
  );

  return pending;
}

// The trailing macrotask lets the response finish parsing and its handlers run,
// so a test can assert on what a late response did (or did not) change.
async function respondTo(
  request: PendingResponse,
  response: ReturnType<typeof jsonResponse>,
) {
  await act(async () => {
    request(response);
    await new Promise((resolve) => setTimeout(resolve));
  });
}

const notFoundResponse = () =>
  jsonResponse(
    {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: '찾을 수 없습니다.',
      instance: '/v1/job-postings',
    },
    404,
  );

// Starts on group A, then switches to B and back to A while B is still pending.
async function returnToGroupABeforeGroupBSettles(
  user: ReturnType<typeof userEvent.setup>,
  pending: ReturnType<typeof stubDeferredPostingsFetch>,
) {
  await user.click(screen.getByRole('button', { name: /그룹 B/ }));
  await waitFor(() => expect(pending[GROUP_B_ID]).toHaveLength(1));
  await user.click(screen.getByRole('button', { name: /그룹 A/ }));
  await waitFor(() => expect(pending[GROUP_A_ID]).toHaveLength(2));
}

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
      if (input === `/v1/auth/me`) {
        return jsonResponse(
          apiResponse({
            user_id: 'user-1',
            email: 'user@example.com',
            name: 'Career OS User',
            picture: null,
          }),
        );
      }

      if ((input as string).startsWith(`/v1/job-search-groups`)) {
        return jsonResponse(emptyGroupsResponse);
      }

      if (input !== `/v1/job-postings?offset=0&limit=50`) {
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
    // calls: auth/me + groups-fetch + first-postings(rate-limited) + retry-postings
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // The manual retry (last call) must carry its own live abort signal, not the
    // click event or the aborted signal of an earlier request.
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    expect(lastCall?.[1]?.signal?.aborted).toBe(false);
  });

  it('shows loading instead of stale results when returning to an already settled group', async () => {
    const user = userEvent.setup();
    const pending = stubDeferredPostingsFetch();

    renderRoute(`/job-postings?group=${GROUP_A_ID}`);

    await waitFor(() => expect(pending[GROUP_A_ID]).toHaveLength(1));
    await respondTo(
      pending[GROUP_A_ID][0],
      jsonResponse(apiResponse(buildTitledPage('A 이전 공고'))),
    );
    await screen.findByRole('heading', { name: 'A 이전 공고' });
    await screen.findByRole('button', { name: /그룹 B/ });

    await returnToGroupABeforeGroupBSettles(user, pending);

    expect(
      screen.queryByRole('heading', { name: 'A 이전 공고' }),
    ).not.toBeInTheDocument();

    await respondTo(
      pending[GROUP_A_ID][1],
      jsonResponse(apiResponse(buildTitledPage('A 최신 공고'))),
    );

    expect(
      await screen.findByRole('heading', { name: 'A 최신 공고' }),
    ).toBeInTheDocument();
  });

  it('shows loading instead of the previous error when returning to a failed group', async () => {
    const user = userEvent.setup();
    const pending = stubDeferredPostingsFetch();
    const errorHeading = { name: '채용공고를 불러오지 못했습니다' };

    renderRoute(`/job-postings?group=${GROUP_A_ID}`);

    await waitFor(() => expect(pending[GROUP_A_ID]).toHaveLength(1));
    await respondTo(pending[GROUP_A_ID][0], notFoundResponse());
    await screen.findByRole('heading', errorHeading);
    await screen.findByRole('button', { name: /그룹 B/ });

    await returnToGroupABeforeGroupBSettles(user, pending);

    expect(screen.queryByRole('heading', errorHeading)).not.toBeInTheDocument();

    await respondTo(
      pending[GROUP_A_ID][1],
      jsonResponse(apiResponse(buildTitledPage('A 복구된 공고'))),
    );

    expect(
      await screen.findByRole('heading', { name: 'A 복구된 공고' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', errorHeading)).not.toBeInTheDocument();
  });

  it('ignores a response from a superseded request that arrives late', async () => {
    const user = userEvent.setup();
    const pending = stubDeferredPostingsFetch();

    renderRoute(`/job-postings?group=${GROUP_A_ID}`);

    await waitFor(() => expect(pending[GROUP_A_ID]).toHaveLength(1));
    await respondTo(
      pending[GROUP_A_ID][0],
      jsonResponse(apiResponse(buildTitledPage('A 이전 공고'))),
    );
    await screen.findByRole('button', { name: /그룹 B/ });

    await returnToGroupABeforeGroupBSettles(user, pending);

    await respondTo(
      pending[GROUP_A_ID][1],
      jsonResponse(apiResponse(buildTitledPage('A 최신 공고'))),
    );
    await screen.findByRole('heading', { name: 'A 최신 공고' });

    await respondTo(
      pending[GROUP_B_ID][0],
      jsonResponse(apiResponse(buildTitledPage('B 늦은 공고'))),
    );

    expect(
      screen.getByRole('heading', { name: 'A 최신 공고' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'B 늦은 공고' }),
    ).not.toBeInTheDocument();
  });
});
