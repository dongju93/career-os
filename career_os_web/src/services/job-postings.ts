import type { JobPostingExtracted, JobPostingPage } from '../types/job-posting';
import { API_BASE_URL } from './api-base-url';

export async function extractJobPosting(
  token: string,
  url: string,
): Promise<JobPostingExtracted> {
  const response = await fetch(
    `${API_BASE_URL}/v1/job-postings/extraction?url=${encodeURIComponent(url)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    let message = `채용공고 정보를 가져오지 못했습니다 (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // use default message
    }
    throw new Error(message);
  }
  return response.json() as Promise<JobPostingExtracted>;
}

export async function saveJobPosting(
  token: string,
  data: JobPostingExtracted,
): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/v1/job-postings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    let message = `저장에 실패했습니다 (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // use default message
    }
    throw new Error(message);
  }
  return response.status;
}

export async function fetchJobPostings(
  token: string,
  offset = 0,
  limit = 50,
): Promise<JobPostingPage> {
  const url = `${API_BASE_URL}/v1/job-postings?offset=${offset}&limit=${limit}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch job postings (${response.status})`);
  }
  return response.json() as Promise<JobPostingPage>;
}
