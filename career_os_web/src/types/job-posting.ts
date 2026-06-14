export type Platform = 'saramin' | 'wanted';

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface JobPostingExtracted {
  platform: Platform;
  posting_id: string;
  posting_url: string;
  company_name: string;
  job_title: string;
  experience_req: string | null;
  deadline: string | null;
  location: string | null;
  employment_type: string | null;
  job_description: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  preferred_points: string | null;
  benefits: string | null;
  hiring_process: string | null;
  education_req: string | null;
  salary: string | null;
  tech_stack: string[] | null;
  tags: string[] | null;
  application_method: string | null;
  application_form: string | null;
  contact_person: string | null;
  homepage: string | null;
  job_category: string | null;
  industry: string | null;
}

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
  group_id: string;
  application_status: ApplicationStatus;
  status_updated_at: string | null;
  scraped_at: string;
  created_at: string;
  updated_at: string;
}

// Partial PATCH body for /v1/job-postings/{id}. At least one field is required.
// `group_id` moves a posting to another owned group; `memo: null` clears the memo
// (§3). Each propose-then-execute confirmation sends exactly one of these.
export interface JobPostingUpdate {
  application_status?: ApplicationStatus;
  group_id?: string;
  memo?: string | null;
}

export interface JobPostingDetail extends JobPostingListItem {
  job_description: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  preferred_points: string | null;
  benefits: string | null;
  hiring_process: string | null;
  education_req: string | null;
  application_method: string | null;
  application_form: string | null;
  contact_person: string | null;
  homepage: string | null;
  // Phase 2: free-form note, detail-only (omitted from list projections).
  memo: string | null;
}

export interface JobPostingPage {
  items: JobPostingListItem[];
  total: number;
  offset: number;
  limit: number;
}
