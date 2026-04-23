import type {
  JobPostingDetail,
  JobPostingExtracted,
  JobPostingPage,
} from '../types/job-posting';
import { API_BASE_URL } from './api-base-url';
import { fetchWithApiRetry } from './api-client';

export async function extractJobPosting(
  token: string,
  url: string,
): Promise<JobPostingExtracted> {
  const response = await fetchWithApiRetry(
    `${API_BASE_URL}/v1/job-postings/extraction?url=${encodeURIComponent(url)}`,
    { headers: { Authorization: `Bearer ${token}` } },
    '채용공고 정보를 가져오지 못했습니다.',
  );
  return response.json() as Promise<JobPostingExtracted>;
}

export async function saveJobPosting(
  token: string,
  data: JobPostingExtracted,
): Promise<number> {
  const response = await fetchWithApiRetry(
    `${API_BASE_URL}/v1/job-postings`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
    '저장에 실패했습니다.',
  );
  return response.status;
}

export async function fetchJobPosting(
  token: string,
  id: number,
): Promise<JobPostingDetail> {
  const response = await fetchWithApiRetry(
    `${API_BASE_URL}/v1/job-postings/${id}`,
    { headers: { Authorization: `Bearer ${token}` } },
    '채용공고를 불러오지 못했습니다.',
  );
  return response.json() as Promise<JobPostingDetail>;
}

export async function fetchJobPostings(
  token: string,
  offset = 0,
  limit = 50,
): Promise<JobPostingPage> {
  const url = `${API_BASE_URL}/v1/job-postings?offset=${offset}&limit=${limit}`;
  const response = await fetchWithApiRetry(
    url,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
    '채용공고 목록을 불러오지 못했습니다.',
  );
  return response.json() as Promise<JobPostingPage>;
}
