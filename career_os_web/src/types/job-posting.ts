export type Platform = 'saramin' | 'wanted';

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
  scraped_at: string;
  created_at: string;
  updated_at: string;
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
}

export interface JobPostingPage {
  items: JobPostingListItem[];
  total: number;
  offset: number;
  limit: number;
}
