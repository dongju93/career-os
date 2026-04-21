import type { JobPostingPage } from '../types/job-posting';
import { API_BASE_URL } from './api-base-url';

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
