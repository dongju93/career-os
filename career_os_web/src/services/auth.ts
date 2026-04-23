import { API_BASE_URL } from './api-base-url';
import { fetchWithApiRetry } from './api-client';

export async function logoutUser(token: string): Promise<void> {
  await fetchWithApiRetry(
    `${API_BASE_URL}/v1/auth/logout`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
    '로그아웃에 실패했습니다.',
  );
}
