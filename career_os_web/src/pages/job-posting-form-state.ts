import type { JobPostingExtracted, Platform } from '../types/job-posting';

export interface JobPostingFormState {
  company_name: string;
  job_title: string;
  location: string;
  experience_req: string;
  employment_type: string;
  education_req: string;
  salary: string;
  deadline: string;
  job_description: string;
  responsibilities: string;
  qualifications: string;
  preferred_points: string;
  benefits: string;
  hiring_process: string;
  tech_stack: string[];
  tags: string[];
  job_category: string;
  industry: string;
  application_method: string;
  application_form: string;
  contact_person: string;
  homepage: string;
}

export interface JobPostingExtractedMeta {
  platform: Platform;
  posting_id: string;
  posting_url: string;
}

export type JobPostingFormErrors = {
  company_name?: string;
  job_title?: string;
};

export type AddJobPostingPhase =
  | { phase: 'idle' }
  | { phase: 'extracting' }
  | {
      phase: 'editing';
      meta: JobPostingExtractedMeta;
      form: JobPostingFormState;
      errors: JobPostingFormErrors;
      saveError: string | null;
    }
  | {
      phase: 'saving';
      meta: JobPostingExtractedMeta;
      form: JobPostingFormState;
    }
  | { phase: 'saved'; company_name: string; job_title: string }
  | { phase: 'extractError'; message: string; code: string };

export function toFormState(data: JobPostingExtracted): JobPostingFormState {
  return {
    company_name: data.company_name,
    job_title: data.job_title,
    location: data.location ?? '',
    experience_req: data.experience_req ?? '',
    employment_type: data.employment_type ?? '',
    education_req: data.education_req ?? '',
    salary: data.salary ?? '',
    deadline: data.deadline ?? '',
    job_description: data.job_description ?? '',
    responsibilities: data.responsibilities ?? '',
    qualifications: data.qualifications ?? '',
    preferred_points: data.preferred_points ?? '',
    benefits: data.benefits ?? '',
    hiring_process: data.hiring_process ?? '',
    tech_stack: data.tech_stack ?? [],
    tags: data.tags ?? [],
    job_category: data.job_category ?? '',
    industry: data.industry ?? '',
    application_method: data.application_method ?? '',
    application_form: data.application_form ?? '',
    contact_person: data.contact_person ?? '',
    homepage: data.homepage ?? '',
  };
}

export function toExtracted(
  form: JobPostingFormState,
  meta: JobPostingExtractedMeta,
): JobPostingExtracted {
  const n = (s: string) => (s.trim() ? s.trim() : null);
  return {
    platform: meta.platform,
    posting_id: meta.posting_id,
    posting_url: meta.posting_url,
    company_name: form.company_name,
    job_title: form.job_title,
    location: n(form.location),
    experience_req: n(form.experience_req),
    employment_type: n(form.employment_type),
    education_req: n(form.education_req),
    salary: n(form.salary),
    deadline: n(form.deadline),
    job_description: n(form.job_description),
    responsibilities: n(form.responsibilities),
    qualifications: n(form.qualifications),
    preferred_points: n(form.preferred_points),
    benefits: n(form.benefits),
    hiring_process: n(form.hiring_process),
    tech_stack: form.tech_stack.length > 0 ? form.tech_stack : null,
    tags: form.tags.length > 0 ? form.tags : null,
    job_category: n(form.job_category),
    industry: n(form.industry),
    application_method: n(form.application_method),
    application_form: n(form.application_form),
    contact_person: n(form.contact_person),
    homepage: n(form.homepage),
  };
}

export function validateForm(form: JobPostingFormState): JobPostingFormErrors {
  const errors: JobPostingFormErrors = {};
  if (!form.company_name.trim()) errors.company_name = '회사명을 입력해주세요.';
  if (!form.job_title.trim()) errors.job_title = '공고 제목을 입력해주세요.';
  return errors;
}
