import { API_BASE_URL } from './api-base-url';

export async function logoutUser(token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/v1/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
