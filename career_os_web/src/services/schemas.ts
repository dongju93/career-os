import { z } from 'zod/v4';

const platformSchema = z.enum(['saramin', 'wanted']);

export const jobPostingExtractedSchema = z.object({
  platform: platformSchema,
  posting_id: z.string(),
  posting_url: z.string(),
  company_name: z.string(),
  job_title: z.string(),
  experience_req: z.string().nullable(),
  deadline: z.string().nullable(),
  location: z.string().nullable(),
  employment_type: z.string().nullable(),
  job_description: z.string().nullable(),
  responsibilities: z.string().nullable(),
  qualifications: z.string().nullable(),
  preferred_points: z.string().nullable(),
  benefits: z.string().nullable(),
  hiring_process: z.string().nullable(),
  education_req: z.string().nullable(),
  salary: z.string().nullable(),
  tech_stack: z.array(z.string()).nullable(),
  tags: z.array(z.string()).nullable(),
  application_method: z.string().nullable(),
  application_form: z.string().nullable(),
  contact_person: z.string().nullable(),
  homepage: z.string().nullable(),
  job_category: z.string().nullable(),
  industry: z.string().nullable(),
});

const jobPostingListItemSchema = z.object({
  id: z.number(),
  platform: platformSchema,
  posting_id: z.string(),
  posting_url: z.string(),
  company_name: z.string(),
  job_title: z.string(),
  experience_req: z.string().nullable(),
  deadline: z.string().nullable(),
  location: z.string().nullable(),
  employment_type: z.string().nullable(),
  salary: z.string().nullable(),
  tech_stack: z.array(z.string()).nullable(),
  tags: z.array(z.string()).nullable(),
  job_category: z.string().nullable(),
  industry: z.string().nullable(),
  scraped_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const jobPostingDetailSchema = jobPostingListItemSchema.extend({
  job_description: z.string().nullable(),
  responsibilities: z.string().nullable(),
  qualifications: z.string().nullable(),
  preferred_points: z.string().nullable(),
  benefits: z.string().nullable(),
  hiring_process: z.string().nullable(),
  education_req: z.string().nullable(),
  application_method: z.string().nullable(),
  application_form: z.string().nullable(),
  contact_person: z.string().nullable(),
  homepage: z.string().nullable(),
});

export const jobPostingPageSchema = z.object({
  items: z.array(jobPostingListItemSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

export const authMeResponseSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  picture: z.string().nullable(),
});
