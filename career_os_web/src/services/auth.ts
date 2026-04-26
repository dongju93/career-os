import { API_BASE_URL } from './api-base-url';
import { fetchWithApiRetry } from './api-client';
import { ApiError, CLIENT_CONTRACT_MISMATCH } from './api-error';
import { authMeApiResponseSchema } from './schemas';

export async function logoutUser(): Promise<void> {
  await fetchWithApiRetry(
    `${API_BASE_URL}/v1/auth/logout`,
    {
      method: 'POST',
    },
    '로그아웃에 실패했습니다.',
  );
}

export interface AuthMeResult {
  user_id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export async function fetchAuthMe(): Promise<AuthMeResult> {
  const response = await fetchWithApiRetry(
    `${API_BASE_URL}/v1/auth/me`,
    undefined,
    '로그인 완료에 실패했습니다. 다시 시도해주세요.',
  );
  const raw = await response.json();
  const result = authMeApiResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new ApiError({
      code: CLIENT_CONTRACT_MISMATCH,
      message: '서버 응답 형식이 올바르지 않습니다.',
      status: 0,
    });
  }
  return result.data.data;
}
