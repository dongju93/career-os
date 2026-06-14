import { z } from 'zod/v4';

const platformSchema = z.enum(['saramin', 'wanted']);

export const applicationStatusSchema = z.enum([
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]);

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
  group_id: z.string().uuid(),
  application_status: applicationStatusSchema,
  status_updated_at: z.string().nullable(),
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

function apiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    status: z.number(),
    message: z.string(),
    data: dataSchema,
  });
}

export const jobPostingExtractedApiResponseSchema = apiResponseSchema(
  jobPostingExtractedSchema,
);

export const jobPostingDetailApiResponseSchema = apiResponseSchema(
  jobPostingDetailSchema,
);

export const jobPostingPageApiResponseSchema =
  apiResponseSchema(jobPostingPageSchema);

export const authMeApiResponseSchema = apiResponseSchema(authMeResponseSchema);

const jobSearchGroupItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  memo: z.string().nullable(),
  posting_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

const jobSearchGroupSchema = jobSearchGroupItemSchema.omit({
  posting_count: true,
});

const jobSearchGroupPageSchema = z.object({
  items: z.array(jobSearchGroupItemSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

export const jobSearchGroupApiResponseSchema =
  apiResponseSchema(jobSearchGroupSchema);

export const jobSearchGroupPageApiResponseSchema = apiResponseSchema(
  jobSearchGroupPageSchema,
);

const userProfileSchema = z.object({
  headline: z.string().nullable(),
  years_experience: z.number().nullable(),
  target_roles: z.array(z.string()).nullable(),
  skills: z.array(z.string()).nullable(),
  locations: z.array(z.string()).nullable(),
  salary_expectation: z.string().nullable(),
  summary: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const userProfileApiResponseSchema =
  apiResponseSchema(userProfileSchema);

const deadlineUrgencySchema = z.enum(['overdue', 'soon', 'later', 'unknown']);

const planItemSchema = z.object({
  job_id: z.number(),
  company_name: z.string(),
  job_title: z.string(),
  fit_score: z.number(),
  matched_skills: z.array(z.string()),
  missing_skills: z.array(z.string()),
  deadline_urgency: deadlineUrgencySchema,
  recommended_action: z.string(),
  rationale: z.string(),
});

// Phase 1 plan shape. `proposed_actions` is deliberately omitted — Zod strips
// unknown keys, so a Phase 2 backend deploy that adds it cannot break this
// client (§5.1); Phase 2 will add the field with `.default([])`.
const applicationPlanSchema = z.object({
  summary: z.string(),
  items: z.array(planItemSchema),
});

export const applicationPlanApiResponseSchema = apiResponseSchema(
  applicationPlanSchema,
);
