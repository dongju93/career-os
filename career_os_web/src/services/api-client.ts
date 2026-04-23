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

export async function fetchWithApiRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackMessage: string,
): Promise<Response> {
  for (let attempt = 1; attempt <= API_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok) return response;

      const apiError = await parseApiError(response, fallbackMessage);
      if (attempt < API_RETRY_ATTEMPTS && shouldRetry(apiError)) {
        await sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      throw apiError;
    } catch (error) {
      if (attempt < API_RETRY_ATTEMPTS && shouldRetry(error)) {
        await sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      throw error;
    }
  }

  throw new Error('unreachable');
}
