import type { UserProfile, UserProfileUpsert } from '../types/user-profile';
import { fetchWithApiRetry } from './api-client';
import { ApiError, CLIENT_CONTRACT_MISMATCH } from './api-error';
import { userProfileApiResponseSchema } from './schemas';

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

// Returns the user's career profile, or `null` when none exists yet.
// A 404 is the documented "no profile yet" signal (§3) — not an error — so we
// swallow it and let callers branch on `null` to show the empty form.
export async function fetchUserProfile(
  signal?: AbortSignal,
): Promise<UserProfile | null> {
  try {
    const response = await fetchWithApiRetry(
      `${import.meta.env.VITE_API_BASE_URL}/v1/profile`,
      { signal },
      '프로필을 불러오지 못했습니다.',
    );
    const raw = await response.json();
    return assertContractMatch(userProfileApiResponseSchema.safeParse(raw))
      .data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// Full-replace upsert. Single-attempt (the non-GET default): a PUT replaces
// the whole profile, but we still avoid silent retries to keep write behavior
// predictable.
export async function saveUserProfile(
  data: UserProfileUpsert,
): Promise<UserProfile> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/profile`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    '프로필을 저장하지 못했습니다.',
  );
  const raw = await response.json();
  return assertContractMatch(userProfileApiResponseSchema.safeParse(raw)).data;
}
