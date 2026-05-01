import { describe, expect, it, vi } from 'vitest';
import type { JobPostingExtracted } from '../types/job-posting';
import { API_BASE_URL } from './api-base-url';
import { ApiError, CLIENT_CONTRACT_MISMATCH } from './api-error';
import {
  extractJobPosting,
  fetchJobPosting,
  fetchJobPostings,
  saveJobPosting,
} from './job-postings';

function okResponse(body: unknown, status = 200) {
  return {
    ok: true,
    status,
    json: async () => body,
  } as unknown as Response;
}

function apiResponse<T>(data: T) {
  return { status: 200, message: 'ok', data };
}

function buildExtracted(
  overrides: Partial<JobPostingExtracted> = {},
): JobPostingExtracted {
  return {
    platform: 'wanted',
    posting_id: 'wd-1',
    posting_url: 'https://www.wanted.co.kr/wd/1',
    company_name: 'Acme Corp',
    job_title: 'Frontend Engineer',
    experience_req: null,
    deadline: null,
    location: null,
    employment_type: null,
    job_description: null,
    responsibilities: null,
    qualifications: null,
    preferred_points: null,
    benefits: null,
    hiring_process: null,
    education_req: null,
    salary: null,
    tech_stack: null,
    tags: null,
    application_method: null,
    application_form: null,
    contact_person: null,
    homepage: null,
    job_category: null,
    industry: null,
    ...overrides,
  };
}

const minimalDetail = {
  id: 1,
  platform: 'wanted' as const,
  posting_id: 'wd-1',
  posting_url: 'https://www.wanted.co.kr/wd/1',
  company_name: 'Acme Corp',
  job_title: 'Frontend Engineer',
  experience_req: null,
  deadline: null,
  location: null,
  employment_type: null,
  salary: null,
  tech_stack: null,
  tags: null,
  job_category: null,
  industry: null,
  scraped_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  job_description: null,
  responsibilities: null,
  qualifications: null,
  preferred_points: null,
  benefits: null,
  hiring_process: null,
  education_req: null,
  application_method: null,
  application_form: null,
  contact_person: null,
  homepage: null,
};

describe('extractJobPosting', () => {
  it('returns the extracted posting on a valid response', async () => {
    const extracted = buildExtracted({ company_name: 'Acme Corp' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse(apiResponse(extracted))),
    );

    const result = await extractJobPosting('https://www.wanted.co.kr/wd/1');

    expect(result.company_name).toBe('Acme Corp');
    expect(result.platform).toBe('wanted');
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
      extractJobPosting('https://example.com'),
    ).rejects.toMatchObject({
      code: CLIENT_CONTRACT_MISMATCH,
    });
    await expect(
      extractJobPosting('https://example.com'),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('saveJobPosting', () => {
  it('returns HTTP status code on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({}, 201)));

    const status = await saveJobPosting(buildExtracted());

    expect(status).toBe(201);
  });

  it('sends a POST to /v1/job-postings with the posting as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({}, 201));
    vi.stubGlobal('fetch', fetchMock);

    const extracted = buildExtracted({ company_name: 'Acme Corp' });
    await saveJobPosting(extracted);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/v1/job-postings`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(extracted),
      }),
    );
  });
});

describe('fetchJobPosting', () => {
  it('returns the detail on a valid response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse(apiResponse(minimalDetail))),
    );

    const result = await fetchJobPosting(1);

    expect(result.id).toBe(1);
    expect(result.company_name).toBe('Acme Corp');
  });

  it('throws ApiError with CLIENT_CONTRACT_MISMATCH on schema mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({
          status: 200,
          message: 'ok',
          data: { id: 'not-a-number' },
        }),
      ),
    );

    await expect(fetchJobPosting(1)).rejects.toMatchObject({
      code: CLIENT_CONTRACT_MISMATCH,
    });
  });
});

describe('fetchJobPostings', () => {
  it('returns the job posting page on a valid response', async () => {
    const page = { items: [], total: 0, offset: 0, limit: 50 };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse(apiResponse(page))),
    );

    const result = await fetchJobPostings();

    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('passes custom offset and limit in the query string', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okResponse(
          apiResponse({ items: [], total: 100, offset: 50, limit: 50 }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await fetchJobPostings(50, 50);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/v1/job-postings?offset=50&limit=50`,
      expect.any(Object),
    );
  });

  it('throws ApiError with CLIENT_CONTRACT_MISMATCH on schema mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          okResponse({ status: 200, message: 'ok', data: 'wrong shape' }),
        ),
    );

    await expect(fetchJobPostings()).rejects.toMatchObject({
      code: CLIENT_CONTRACT_MISMATCH,
    });
  });
});
