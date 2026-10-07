import { AuthError } from '@/services/auth/types';

import { createHttpProfileClient } from './profileClient';
import { defaultOnboarding, defaultSettings, isSettingsDoc } from './types';

function fakeFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    return handler(url, init ?? {});
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('http profile client', () => {
  it('reads a document, dropping the server-only storedAt', async () => {
    const doc = { ...defaultOnboarding(7), step: 'safety' as const };
    const { fetchImpl, calls } = fakeFetch(() => json({ onboarding: { ...doc, storedAt: 99 } }));
    const client = createHttpProfileClient({ baseUrl: 'http://api/', fetch: fetchImpl });
    const result = await client.get('onboarding', 'tok');
    expect(result).toEqual(doc);
    expect(calls[0]?.url).toBe('http://api/me/onboarding');
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('answers null for an empty document and for a shape this app does not know', async () => {
    const { fetchImpl } = fakeFetch((url) =>
      url.endsWith('/me/onboarding')
        ? json({ onboarding: null })
        : json({ settings: { version: 7, updatedAt: 1, storedAt: 2 } }),
    );
    const client = createHttpProfileClient({ baseUrl: 'http://api', fetch: fetchImpl });
    expect(await client.get('onboarding', 'tok')).toBeNull();
    expect(await client.get('settings', 'tok')).toBeNull();
  });

  it('writes the whole document and returns what the server stored', async () => {
    const newer = { ...defaultSettings(20), crocName: 'Later' };
    const { fetchImpl, calls } = fakeFetch(() => json({ settings: { ...newer, storedAt: 21 } }));
    const client = createHttpProfileClient({ baseUrl: 'http://api', fetch: fetchImpl });
    const sent = { ...defaultSettings(10), crocName: 'Earlier' };
    const stored = await client.put('settings', sent, 'tok');
    expect(stored).toEqual(newer);
    expect(calls[0]?.init.method).toBe('PUT');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(sent);
  });

  it('asks for settings v2 and upgrades a v1 answer (a server that has not moved on)', async () => {
    const { fieldsAt: _f, reducedMotion: _r, ...rest } = defaultSettings(40);
    const { fetchImpl, calls } = fakeFetch((url) =>
      json({ settings: { ...rest, version: 1, sound: false, storedAt: 41 } }),
    );
    const client = createHttpProfileClient({ baseUrl: 'http://api', fetch: fetchImpl });
    const doc = await client.get('settings', 'tok');
    expect(calls[0]?.url).toBe('http://api/me/settings?v=2');
    expect(doc && isSettingsDoc(doc)).toBe(true);
    expect(doc).toMatchObject({ version: 2, sound: false, reducedMotion: null, updatedAt: 40 });
    // The same for the answer to a write.
    const put = await client.put('settings', defaultSettings(40), 'tok');
    expect(isSettingsDoc(put)).toBe(true);
    // Other kinds are asked for without a version.
    const other = fakeFetch(() => json({ onboarding: null }));
    await createHttpProfileClient({ baseUrl: 'http://api', fetch: other.fetchImpl }).get(
      'onboarding',
      'tok',
    );
    expect(other.calls[0]?.url).toBe('http://api/me/onboarding');
  });

  it('maps server errors', async () => {
    const { fetchImpl } = fakeFetch((url) =>
      url.includes('/me/settings')
        ? json({ error: { code: 'unauthorized', message: 'nope' } }, 401)
        : json(
            { error: { code: 'invalid_request', fields: { crocName: 'invalid_request' } } },
            400,
          ),
    );
    const client = createHttpProfileClient({ baseUrl: 'http://api', fetch: fetchImpl });
    await expect(client.get('settings', 'tok')).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(client.put('onboarding', defaultOnboarding(1), 'tok')).rejects.toMatchObject({
      code: 'invalid_request',
      fields: { crocName: 'invalid_request' },
    });
  });

  it('reports a malformed success body as a server error', async () => {
    const { fetchImpl } = fakeFetch(() => json({ onboarding: 'what' }));
    const client = createHttpProfileClient({ baseUrl: 'http://api', fetch: fetchImpl });
    await expect(client.get('onboarding', 'tok')).rejects.toBeInstanceOf(AuthError);
  });
});
