import type {
  JobSearchGroup,
  JobSearchGroupPage,
} from '../types/job-search-group';
import { fetchWithApiRetry } from './api-client';
import { parseApiResponse } from './parse-response';
import {
  jobSearchGroupApiResponseSchema,
  jobSearchGroupPageApiResponseSchema,
} from './schemas';

export async function fetchJobSearchGroups(
  params?: {
    status?: 'active' | 'ended';
    offset?: number;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<JobSearchGroupPage> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.size > 0 ? `?${query.toString()}` : '';

  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/job-search-groups${qs}`,
    { signal },
    '구직 활동 그룹 목록을 불러오지 못했습니다.',
  );
  return parseApiResponse(jobSearchGroupPageApiResponseSchema, response);
}

export async function createJobSearchGroup(data: {
  name: string;
  started_at?: string;
  ended_at?: string | null;
  memo?: string | null;
}): Promise<JobSearchGroup> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/job-search-groups`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    '구직 활동 그룹을 생성하지 못했습니다.',
  );
  return parseApiResponse(jobSearchGroupApiResponseSchema, response);
}

export async function fetchJobSearchGroup(
  id: string,
  signal?: AbortSignal,
): Promise<JobSearchGroup> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/job-search-groups/${id}`,
    { signal },
    '구직 활동 그룹을 불러오지 못했습니다.',
  );
  return parseApiResponse(jobSearchGroupApiResponseSchema, response);
}

export async function updateJobSearchGroup(
  id: string,
  data: {
    name?: string;
    started_at?: string;
    ended_at?: string | null;
    memo?: string | null;
  },
): Promise<JobSearchGroup> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/job-search-groups/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    '구직 활동 그룹을 수정하지 못했습니다.',
  );
  return parseApiResponse(jobSearchGroupApiResponseSchema, response);
}

export async function deleteJobSearchGroup(id: string): Promise<void> {
  await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/job-search-groups/${id}`,
    { method: 'DELETE' },
    '구직 활동 그룹을 삭제하지 못했습니다.',
  );
}
