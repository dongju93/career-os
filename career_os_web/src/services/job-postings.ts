import type {
  JobPostingDetail,
  JobPostingExtracted,
  JobPostingPage,
  JobPostingUpdate,
} from '../types/job-posting';
import { fetchWithApiRetry } from './api-client';
import { ApiError, CLIENT_CONTRACT_MISMATCH } from './api-error';
import {
  jobPostingDetailApiResponseSchema,
  jobPostingExtractedApiResponseSchema,
  jobPostingPageApiResponseSchema,
} from './schemas';

const CONTRACT_ERROR_MESSAGE = '서버 응답 형식이 올바르지 않습니다.';

function assertContractMatch<T>(
  result: { success: true; data: T } | { success: false },
): T {
  if (!result.success) {
    throw new ApiError({
      code: CLIENT_CONTRACT_MISMATCH,
      message: CONTRACT_ERROR_MESSAGE,
      status: 0,
    });
  }
  return result.data;
}

export async function extractJobPosting(
  url: string,
  signal?: AbortSignal,
): Promise<JobPostingExtracted> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings/extraction?url=${encodeURIComponent(url)}`,
    { signal },
    '채용공고 정보를 가져오지 못했습니다.',
  );
  const raw = await response.json();
  return assertContractMatch(
    jobPostingExtractedApiResponseSchema.safeParse(raw),
  ).data;
}

export async function saveJobPosting(
  data: JobPostingExtracted,
  groupId?: string,
): Promise<JobPostingDetail> {
  const body = groupId ? { ...data, group_id: groupId } : data;
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    '저장에 실패했습니다.',
    { retryable: true }, // POST /v1/job-postings is a server-side upsert
  );
  const raw = await response.json();
  return assertContractMatch(jobPostingDetailApiResponseSchema.safeParse(raw))
    .data;
}

export async function fetchJobPosting(
  id: number,
  signal?: AbortSignal,
): Promise<JobPostingDetail> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings/${id}`,
    { signal },
    '채용공고를 불러오지 못했습니다.',
  );
  const raw = await response.json();
  return assertContractMatch(jobPostingDetailApiResponseSchema.safeParse(raw))
    .data;
}

// Partial update of a saved posting (Phase 0: application_status). Deliberately
// single-attempt — never pass `retryable`: a status PATCH is not idempotent and
// must not be silently re-sent.
export async function updateJobPosting(
  id: number,
  patch: JobPostingUpdate,
): Promise<JobPostingDetail> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
    '채용공고를 수정하지 못했습니다.',
  );
  const raw = await response.json();
  return assertContractMatch(jobPostingDetailApiResponseSchema.safeParse(raw))
    .data;
}

export async function fetchJobPostings(
  offset = 0,
  limit = 50,
  groupId?: string,
  signal?: AbortSignal,
): Promise<JobPostingPage> {
  let url = `${import.meta.env.VITE_API_BASE_URL}/v1/job-postings?offset=${offset}&limit=${limit}`;
  if (groupId) url += `&group_id=${encodeURIComponent(groupId)}`;
  const response = await fetchWithApiRetry(
    url,
    { signal },
    '채용공고 목록을 불러오지 못했습니다.',
  );
  const raw = await response.json();
  return assertContractMatch(jobPostingPageApiResponseSchema.safeParse(raw))
    .data;
}
