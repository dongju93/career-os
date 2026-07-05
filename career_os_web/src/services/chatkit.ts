import {
  withAccessTokenHeader,
  withCareerOsSessionHeaders,
} from './api-client';

/**
 * Absolute URL of the backend ChatKit endpoint. ChatKit posts its streaming
 * protocol here; the backend owns session creation, so the client never
 * requests a `client_secret`.
 */
export function getChatKitApiUrl(): string {
  return `${import.meta.env.VITE_API_BASE_URL}/v1/chatkit`;
}

/**
 * Domain key registered with OpenAI for the deployed origin. Supplied via
 * `.env` as `VITE_CHATKIT_DOMAIN_KEY`; Vite exposes it automatically because
 * of the `VITE_` prefix. Do not hardcode it in `vite.config.ts`.
 */
export function getChatKitDomainKey(): string {
  return import.meta.env.VITE_CHATKIT_DOMAIN_KEY;
}

/**
 * Fetch wrapper passed to ChatKit's `api.fetch`. It reuses the app's session
 * auth (cookie + `X-Career-OS-Client: web`, with the Bearer token fallback for
 * browsers that block the cross-site session cookie) but deliberately does
 * NOT go through `fetchWithApiRetry`: ChatKit responses are streamed, must not
 * be retried, and are not the `ApiResponse` envelope that Zod schemas validate.
 */
export async function chatKitFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? 'include',
    headers: withCareerOsSessionHeaders(withAccessTokenHeader(init?.headers)),
  });
}
