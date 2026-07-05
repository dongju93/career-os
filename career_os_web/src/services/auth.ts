import { fetchWithApiRetry, setAccessToken } from './api-client';
import { parseApiResponse } from './parse-response';
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
// Chrome third-party cookie blocking): obtains a Bearer token that setAccessToken
// persists so it survives a full page reload (see api-client.ts).
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
  const { access_token } = await parseApiResponse(
    accessTokenApiResponseSchema,
    response,
  );
  setAccessToken(access_token);
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
  return parseApiResponse(authMeApiResponseSchema, response);
}
