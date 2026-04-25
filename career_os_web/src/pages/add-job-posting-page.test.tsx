import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '../services/api-base-url';
import { useAuthStore } from '../store/auth-store';
import { renderRoute } from '../test/test-utils';
import type { JobPostingExtracted } from '../types/job-posting';

const postingUrl = 'https://www.wanted.co.kr/wd/123';
const unsupportedUrl = 'https://example.com/jobs/1';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function buildExtractedPosting(
  overrides: Partial<JobPostingExtracted> = {},
): JobPostingExtracted {
  return {
    platform: 'wanted',
    posting_id: 'wd-123',
    posting_url: postingUrl,
    company_name: 'Career OS',
    job_title: 'Frontend Engineer',
    experience_req: '3년 이상',
    deadline: '상시',
    location: '서울',
    employment_type: '정규직',
    education_req: null,
    salary: '면접 후 결정',
    job_description: 'Frontend product work',
    responsibilities: 'Build user-facing workflows',
    qualifications: 'React experience',
    preferred_points: null,
    benefits: null,
    hiring_process: null,
    tech_stack: ['React', 'TypeScript'],
    tags: ['frontend'],
    job_category: 'Engineering',
    industry: 'Software',
    application_method: null,
    application_form: null,
    contact_person: null,
    homepage: null,
    ...overrides,
  };
}

describe('AddJobPostingPage', () => {
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

  it('extracts a posting, lets the user edit it, and saves the normalized payload', async () => {
    const user = userEvent.setup();
    const extractedPosting = buildExtractedPosting();
    let savedPayload: JobPostingExtracted | null = null;
    let saveInit: RequestInit | undefined;

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (
        input ===
        `${API_BASE_URL}/v1/job-postings/extraction?url=${encodeURIComponent(postingUrl)}`
      ) {
        return jsonResponse(extractedPosting);
      }

      if (input === `${API_BASE_URL}/v1/job-postings`) {
        saveInit = init;
        savedPayload = JSON.parse(String(init?.body)) as JobPostingExtracted;
        return jsonResponse({}, 201);
      }

      throw new Error(`Unexpected fetch request: ${input}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/job-postings/new');

    await user.type(
      await screen.findByPlaceholderText('https://www.saramin.co.kr/...'),
      postingUrl,
    );
    await user.click(screen.getByRole('button', { name: /불러오기/ }));

    expect(await screen.findByDisplayValue('Career OS')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Frontend Engineer')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^채용공고 제목/));
    await user.type(
      screen.getByLabelText(/^채용공고 제목/),
      'Senior Frontend Engineer',
    );
    await user.clear(screen.getByLabelText(/^근무지역/));
    await user.type(screen.getByLabelText(/^근무지역/), '  서울 강남  ');
    await user.clear(screen.getByLabelText(/^급여/));
    await user.type(screen.getByLabelText(/^급여/), '    ');
    await user.click(screen.getByRole('button', { name: /^저장$/ }));

    expect(
      await screen.findByRole('heading', { name: '저장 완료!' }),
    ).toBeInTheDocument();
    expect(saveInit).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    });
    expect(savedPayload).toMatchObject({
      platform: 'wanted',
      posting_id: 'wd-123',
      posting_url: postingUrl,
      company_name: 'Career OS',
      job_title: 'Senior Frontend Engineer',
      location: '서울 강남',
      salary: null,
      tech_stack: ['React', 'TypeScript'],
      tags: ['frontend'],
    });
  });

  it('clears stale extracted data when a later extraction fails', async () => {
    const user = userEvent.setup();
    let extractionCalls = 0;

    const fetchMock = vi.fn(async (input: string, _init?: RequestInit) => {
      if (input.includes('/v1/job-postings/extraction?url=')) {
        extractionCalls += 1;

        if (extractionCalls === 1) {
          return jsonResponse(buildExtractedPosting());
        }

        return jsonResponse(
          {
            detail: {
              code: 'UNSUPPORTED_PLATFORM',
              message: '지원하지 않는 채용공고 URL입니다.',
            },
          },
          422,
        );
      }

      throw new Error(`Unexpected fetch request: ${input}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderRoute('/job-postings/new');

    const urlInput = await screen.findByPlaceholderText(
      'https://www.saramin.co.kr/...',
    );
    await user.type(urlInput, postingUrl);
    await user.click(screen.getByRole('button', { name: /불러오기/ }));

    expect(await screen.findByDisplayValue('Career OS')).toBeInTheDocument();

    await user.clear(urlInput);
    await user.type(urlInput, unsupportedUrl);
    await user.click(screen.getByRole('button', { name: /불러오기/ }));

    expect(
      await screen.findByText('지원하지 않는 채용공고 URL입니다.'),
    ).toBeInTheDocument();
    expect(screen.getByText('UNSUPPORTED_PLATFORM')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Career OS')).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /^저장$/ }),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(false);
  });
});
