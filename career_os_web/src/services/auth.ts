import { fetchWithApiRetry } from './api-client';
import { parseApiResponse } from './parse-response';
import { authMeApiResponseSchema } from './schemas';

export async function logoutUser(): Promise<void> {
  await fetchWithApiRetry(
    `/v1/auth/logout`,
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
    `/v1/auth/me`,
    undefined,
    '로그인 완료에 실패했습니다. 다시 시도해주세요.',
  );
  return parseApiResponse(authMeApiResponseSchema, response);
}
