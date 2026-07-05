import {
  withAccessTokenHeader,
  withCareerOsSessionHeaders,
} from './api-client';

/**
 * OpenAI-hosted script that registers the `<openai-chatkit>` custom element
 * rendered by `@openai/chatkit-react`'s `<ChatKit>`. The React binding is only
 * glue + types; the actual web component lives here on OpenAI's CDN.
 */
const CHATKIT_SCRIPT_SRC =
  'https://cdn.platform.openai.com/deployments/chatkit/chatkit.js';

// Cached across calls so the script is injected at most once per document.
let chatKitScriptPromise: Promise<void> | null = null;

/**
 * Lazily inject the ChatKit CDN script the first time it is needed.
 *
 * This used to live as an eager `<script async>` in `index.html`, which made
 * every visitor — the login page and authenticated pages where the assistant is
 * never opened — download and parse a third-party script they don't use. We now
 * inject it on first assistant open instead.
 *
 * There is no ordering hazard: `<ChatKit>` waits on
 * `customElements.whenDefined('openai-chatkit')` before applying options, so it
 * renders correctly whenever this load completes — before or after mount.
 *
 * Idempotent: the returned promise is cached, so repeated calls reuse the same
 * in-flight/settled load and never append a second `<script>`. A load failure
 * clears the cache so a later call can retry (e.g. when the user reopens the
 * assistant after a transient CDN error).
 */
export function loadChatKitScript(): Promise<void> {
  if (chatKitScriptPromise) return chatKitScriptPromise;

  chatKitScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHATKIT_SCRIPT_SRC}"]`,
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = CHATKIT_SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => {
        chatKitScriptPromise = null;
        reject(new Error('Failed to load the ChatKit script'));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return chatKitScriptPromise;
}

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
