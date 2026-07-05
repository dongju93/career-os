import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from './api-client';
import { chatKitFetch, getChatKitApiUrl, getChatKitDomainKey } from './chatkit';

const CHATKIT_SCRIPT_SRC =
  'https://cdn.platform.openai.com/deployments/chatkit/chatkit.js';

function chatKitScripts() {
  return document.querySelectorAll<HTMLScriptElement>(
    `script[src="${CHATKIT_SCRIPT_SRC}"]`,
  );
}

function okResponse() {
  return { ok: true, status: 200 } as unknown as Response;
}

describe('chatkit service', () => {
  afterEach(() => {
    setAccessToken(null);
  });

  it('builds the ChatKit API URL from the configured base URL', () => {
    expect(getChatKitApiUrl()).toBe(
      'https://career-os.fastapicloud.dev/v1/chatkit',
    );
  });

  it('exposes the configured domain key', () => {
    expect(getChatKitDomainKey()).toBe('test-placeholder');
  });

  it('sends credentials: include and the X-Career-OS-Client header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await chatKitFetch('https://career-os.fastapicloud.dev/v1/chatkit', {
      method: 'POST',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe('include');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('X-Career-OS-Client')).toBe('web');
  });

  it('preserves caller headers while adding the session client header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await chatKitFetch('/v1/chatkit', {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(fetchMock).toHaveBeenCalledWith('/v1/chatkit', {
      credentials: 'include',
      headers: {
        'X-Career-OS-Client': 'web',
        'Content-Type': 'application/json',
      },
    });
  });

  it('does not override an explicitly provided credentials value', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await chatKitFetch('/v1/chatkit', { credentials: 'same-origin' });

    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
  });

  it('attaches the Bearer token as a fallback for cookie-blocking browsers', async () => {
    setAccessToken('login-token');
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await chatKitFetch('/v1/chatkit', { method: 'POST' });

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer login-token',
    );
  });
});

describe('loadChatKitScript', () => {
  beforeEach(() => {
    // Reset the module registry so the loader's cached promise starts empty in
    // every test, and clear any script a previous test injected (Testing
    // Library cleanup does not remove manually-appended <script> tags).
    vi.resetModules();
    for (const script of chatKitScripts()) {
      script.remove();
    }
  });

  it('injects the ChatKit CDN script exactly once across repeated calls', async () => {
    const { loadChatKitScript } = await import('./chatkit');

    loadChatKitScript();
    loadChatKitScript();

    const scripts = chatKitScripts();
    expect(scripts.length).toBe(1);
    expect(scripts[0].async).toBe(true);
  });

  it('resolves once the injected script fires its load event', async () => {
    const { loadChatKitScript } = await import('./chatkit');

    const promise = loadChatKitScript();
    chatKitScripts()[0].dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects and allows a retry when the script fails to load', async () => {
    const { loadChatKitScript } = await import('./chatkit');

    const first = loadChatKitScript();
    chatKitScripts()[0].dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow(/ChatKit/);

    // The failed load cleared the cache, so a retry injects a fresh script.
    loadChatKitScript();
    expect(chatKitScripts().length).toBe(1);
  });

  it('reuses an existing script tag instead of injecting a duplicate', async () => {
    const existing = document.createElement('script');
    existing.src = CHATKIT_SCRIPT_SRC;
    document.head.appendChild(existing);

    const { loadChatKitScript } = await import('./chatkit');

    await expect(loadChatKitScript()).resolves.toBeUndefined();
    expect(chatKitScripts().length).toBe(1);
  });
});
