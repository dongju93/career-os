import type {
  ApplicationArtifact,
  ArtifactType,
} from '../types/application-artifact';
import type { ApplicationPlan } from '../types/application-plan';
import { fetchWithApiRetry } from './api-client';
import { parseApiResponse } from './parse-response';
import {
  applicationArtifactApiResponseSchema,
  applicationPlanApiResponseSchema,
} from './schemas';

// Generates a prioritized Application Plan over a job-search group.
//
// Deliberately single-attempt — never pass `retryable`: a plan run takes
// ~10–60 s of model time against a 5/min + 30/day quota (§5.2), so an automatic
// retry would double-bill the user. The page owns the AbortController and passes
// its signal here so navigation away cancels the in-flight request.
export async function generateApplicationPlan(
  body: { group_id?: string | null; focus?: string | null },
  signal?: AbortSignal,
): Promise<ApplicationPlan> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/agent/plan`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
    '지원 전략 플랜을 생성하지 못했습니다.',
  );
  return parseApiResponse(applicationPlanApiResponseSchema, response);
}

// Generates a single per-posting artifact (resume bullets / cover-letter points /
// interview prep) via POST /v1/agent/artifact (§7).
//
// Same cost profile as the plan run: a model call against a 5/min + 20/day quota,
// so it is deliberately single-attempt — never pass `retryable`. The caller owns
// the AbortController and forwards its signal so unmount cancels the request.
export async function generateArtifact(
  body: {
    job_id: number;
    artifact_type: ArtifactType;
    focus?: string | null;
  },
  signal?: AbortSignal,
): Promise<ApplicationArtifact> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/agent/artifact`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
    'AI 지원 자료를 생성하지 못했습니다.',
  );
  return parseApiResponse(applicationArtifactApiResponseSchema, response);
}
