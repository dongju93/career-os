import {
  ApiError,
  DATABASE_UNAVAILABLE_CODE,
  parseApiError,
} from './api-error';

const API_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 500;

function shouldRetry(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError &&
      (error.code === DATABASE_UNAVAILABLE_CODE || error.status >= 500))
  );
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type FetchWithRetryOptions = {
  retryable?: boolean;
};

export async function fetchWithApiRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackMessage: string,
  { retryable }: FetchWithRetryOptions = {},
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const maxAttempts = (retryable ?? method === 'GET') ? API_RETRY_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok) return response;

      const apiError = await parseApiError(response, fallbackMessage);
      if (attempt < maxAttempts && shouldRetry(apiError)) {
        await sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      throw apiError;
    } catch (error) {
      if (attempt < maxAttempts && shouldRetry(error)) {
        await sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      throw error;
    }
  }

  throw new Error('unreachable');
}
