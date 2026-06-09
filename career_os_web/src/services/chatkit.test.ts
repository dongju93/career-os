import { describe, expect, it, vi } from 'vitest';
import { chatKitFetch, getChatKitApiUrl, getChatKitDomainKey } from './chatkit';

function okResponse() {
  return { ok: true, status: 200 } as unknown as Response;
}

describe('chatkit service', () => {
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
});
