import { fetchWithApiRetry, setAccessToken } from './api-client';
import { ApiError, CLIENT_CONTRACT_MISMATCH } from './api-error';
import {
  accessTokenApiResponseSchema,
  authMeApiResponseSchema,
} from './schemas';

export async function logoutUser(): Promise<void> {
  await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/auth/logout`,
    {
      method: 'POST',
    },
    '로그아웃에 실패했습니다.',
  );
}

// Fallback for browsers that drop the cross-site session cookie (Safari ITP,
// Chrome third-party cookie blocking): stashes a Bearer token in memory.
export async function exchangeLoginCode(loginCode: string): Promise<void> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/auth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_code: loginCode }),
    },
    '로그인 토큰 발급에 실패했습니다.',
  );
  const raw = await response.json();
  const result = accessTokenApiResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new ApiError({
      code: CLIENT_CONTRACT_MISMATCH,
      message: '서버 응답 형식이 올바르지 않습니다.',
      status: 0,
    });
  }
  setAccessToken(result.data.data.access_token);
}

export interface AuthMeResult {
  user_id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export async function fetchAuthMe(): Promise<AuthMeResult> {
  const response = await fetchWithApiRetry(
    `${import.meta.env.VITE_API_BASE_URL}/v1/auth/me`,
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
