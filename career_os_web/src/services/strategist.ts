import type {
  ApplicationArtifact,
  ArtifactType,
} from '../types/application-artifact';
import type { ApplicationPlan } from '../types/application-plan';
import { fetchWithApiRetry } from './api-client';
import { ApiError, CLIENT_CONTRACT_MISMATCH } from './api-error';
import {
  applicationArtifactApiResponseSchema,
  applicationPlanApiResponseSchema,
} from './schemas';

const CONTRACT_ERROR_MESSAGE = '서버 응답 형식이 올바르지 않습니다.';

function assertContractMatch<T>(
  result: { success: true; data: T } | { success: false },
): T {
  if (!result.success) {
    throw new ApiError({
      code: CLIENT_CONTRACT_MISMATCH,
      message: CONTRACT_ERROR_MESSAGE,
      status: 0,
    });
  }
  return result.data;
}

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
  const raw = await response.json();
  return assertContractMatch(applicationPlanApiResponseSchema.safeParse(raw))
    .data;
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
  const raw = await response.json();
  return assertContractMatch(
    applicationArtifactApiResponseSchema.safeParse(raw),
  ).data;
}
