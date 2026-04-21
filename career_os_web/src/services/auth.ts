const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8000';

export async function logoutUser(token: string): Promise<void> {
  await fetch(`${API_BASE}/v1/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
