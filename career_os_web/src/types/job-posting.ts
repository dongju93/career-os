export type Platform = 'saramin' | 'wanted';

export interface JobPostingListItem {
  id: number;
  platform: Platform;
  posting_id: string;
  posting_url: string;
  company_name: string;
  job_title: string;
  experience_req: string | null;
  deadline: string | null;
  location: string | null;
  employment_type: string | null;
  salary: string | null;
  tech_stack: string[] | null;
  tags: string[] | null;
  job_category: string | null;
  industry: string | null;
  scraped_at: string;
  created_at: string;
  updated_at: string;
}

export interface JobPostingPage {
  items: JobPostingListItem[];
  total: number;
  offset: number;
  limit: number;
}
