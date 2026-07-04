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
  // Phase 2: memo is detail-only — the list projection omits it.
  memo: z.string().nullable(),
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

export const accessTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
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

export const accessTokenApiResponseSchema = apiResponseSchema(
  accessTokenResponseSchema,
);

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

// Phase 2 propose-then-execute action. `target_group_id` is a UUID per §3, but
// kept as a plain nullable string here: model output is untrusted and the PATCH
// re-validates it server-side, so a stray format must not throw away an
// otherwise-good plan at the contract boundary.
const proposedActionSchema = z.object({
  action_type: z.enum(['set_status', 'assign_group', 'save_memo']),
  job_id: z.number(),
  application_status: applicationStatusSchema.nullable(),
  target_group_id: z.string().nullable(),
  memo: z.string().nullable(),
  reason: z.string(),
});

// `proposed_actions` defaults to [] so a backend that has not yet shipped Phase 2
// (field absent) still parses, and consumers can read the array unconditionally
// (§6).
const applicationPlanSchema = z.object({
  summary: z.string(),
  items: z.array(planItemSchema),
  proposed_actions: z.array(proposedActionSchema).default([]),
});

export const applicationPlanApiResponseSchema = apiResponseSchema(
  applicationPlanSchema,
);

// Phase 3 (§7): per-posting artifact generation. `content_markdown` is kept as a
// plain string (capped server-side at 12000 chars) — the client renders it as
// pre-wrapped text, so no markdown shape needs validating here.
const artifactTypeSchema = z.enum([
  'resume_bullets',
  'cover_letter',
  'interview_prep',
]);

const applicationArtifactSchema = z.object({
  artifact_type: artifactTypeSchema,
  job_id: z.number(),
  title: z.string(),
  content_markdown: z.string(),
});

export const applicationArtifactApiResponseSchema = apiResponseSchema(
  applicationArtifactSchema,
);
