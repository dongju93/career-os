import type { JobPostingPage } from '../types/job-posting';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'https://career-os.fastapicloud.dev';

export async function fetchJobPostings(
  token: string,
  offset = 0,
  limit = 50,
): Promise<JobPostingPage> {
  const url = `${API_BASE}/v1/job-postings?offset=${offset}&limit=${limit}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch job postings (${response.status})`);
  }
  return response.json() as Promise<JobPostingPage>;
}
