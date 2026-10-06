import { createHttpAuthClient } from './httpAuthClient';
import { AuthError } from './types';

const tokens = {
  tokenType: 'Bearer',
  accessToken: 'a.b.c',
  accessTokenExpiresAt: '2026-01-01T12:15:00.000Z',
  refreshToken: 'r1',
  refreshTokenExpiresAt: '2026-01-31T12:00:00.000Z',
};
const user = {
  id: 'u1',
  email: 'ann@example.com',
  displayName: 'Ann',
  signupClient: 'mhp-coaching',
  createdAt: '2026-01-01T12:00:00.000Z',
  clients: [],
};

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function setup(responder: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fetchMock = jest.fn((url: string, init: RequestInit) =>
    Promise.resolve(responder(url, init)),
  );
  let offline = false;
  const client = createHttpAuthClient({
    baseUrl: 'http://api.test/',
    clientId: 'mhp-hypnose',
    fetch: fetchMock as unknown as typeof fetch,
    isOffline: () => offline,
    timeoutMs: 1000,
  });
  return {
    client,
    fetchMock,
    setOffline: (v: boolean) => {
      offline = v;
    },
  };
}

async function errorOf(promise: Promise<unknown>): Promise<AuthError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }
  throw new Error('expected an AuthError');
}

describe('createHttpAuthClient', () => {
  it('signs in with the client id and maps the result', async () => {
    const { client, fetchMock } = setup(() => json(200, { user, tokens }));
    const result = await client.signIn({ email: 'ann@example.com', password: 'secret12' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.test/auth/signin');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'ann@example.com',
      password: 'secret12',
      clientId: 'mhp-hypnose',
    });
    expect(result.user).toEqual({
      id: 'u1',
      email: 'ann@example.com',
      displayName: 'Ann',
      signupClient: 'mhp-coaching',
    });
    expect(result.tokens.accessTokenExpiresAt).toBe(Date.parse(tokens.accessTokenExpiresAt));
  });

  it('sends sign-up with a null display name when none is given', async () => {
    const { client, fetchMock } = setup(() => json(201, { user, tokens }));
    await client.signUp({ email: 'a@b.co', password: 'secret12' });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toMatchObject({
      displayName: null,
      clientId: 'mhp-hypnose',
    });
  });

  it('sends the bearer token for profile and delete, and handles 204', async () => {
    const { client, fetchMock } = setup((url, init) =>
      init.method === 'DELETE' ? new Response(null, { status: 204 }) : json(200, { user }),
    );
    await expect(client.getProfile('tok')).resolves.toMatchObject({ id: 'u1' });
    await expect(client.deleteAccount('tok')).resolves.toBeUndefined();
    for (const [, init] of fetchMock.mock.calls) {
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    }
  });

  it('maps server error codes', async () => {
    const cases: [number, string, string][] = [
      [401, 'invalid_credentials', 'invalid_credentials'],
      [409, 'email_taken', 'email_taken'],
      [400, 'weak_password', 'weak_password'],
      [401, 'invalid_refresh_token', 'session_ended'],
      [401, 'refresh_token_reused', 'session_ended'],
      [401, 'unauthorized', 'unauthorized'],
      [418, 'teapot', 'unknown'],
    ];
    for (const [status, server, app] of cases) {
      const { client } = setup(() => json(status, { error: { code: server, message: 'm' } }));
      expect((await errorOf(client.signIn({ email: 'a', password: 'b' }))).code).toBe(app);
    }
  });

  it('keeps field errors', async () => {
    const { client } = setup(() =>
      json(400, {
        error: {
          code: 'invalid_request',
          message: 'm',
          fields: { email: 'invalid_email', password: 'weak_password', other: 'weird' },
        },
      }),
    );
    const err = await errorOf(client.signUp({ email: 'a', password: 'b' }));
    expect(err.fields).toEqual({
      email: 'invalid_email',
      password: 'weak_password',
      other: 'invalid_request',
    });
  });

  it('reports rate limiting with the retry delay', async () => {
    const { client } = setup(() =>
      json(429, { error: { code: 'rate_limited', message: 'm' } }, { 'retry-after': '42' }),
    );
    const err = await errorOf(client.signIn({ email: 'a', password: 'b' }));
    expect(err.code).toBe('rate_limited');
    expect(err.retryAfterSeconds).toBe(42);
  });

  it('distinguishes server errors, a server that is down and being offline', async () => {
    expect((await errorOf(setup(() => json(500, { error: {} })).client.refresh('r'))).code).toBe(
      'server_error',
    );
    expect(
      (await errorOf(setup(() => new Response('<html>', { status: 503 })).client.refresh('r')))
        .code,
    ).toBe('unreachable');
    expect(
      (await errorOf(setup(() => new Response('<html>', { status: 200 })).client.refresh('r')))
        .code,
    ).toBe('server_error');
    const down = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    const err = await errorOf(down.client.signIn({ email: 'a', password: 'b' }));
    expect(err.code).toBe('unreachable');
    expect(err.isConnectivity).toBe(true);

    const offline = setup(() => json(200, { user, tokens }));
    offline.setOffline(true);
    expect((await errorOf(offline.client.signIn({ email: 'a', password: 'b' }))).code).toBe(
      'offline',
    );
    expect(offline.fetchMock).not.toHaveBeenCalled();
  });

  it('gives up after the timeout', async () => {
    jest.useFakeTimers();
    try {
      const { client } = setup(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      const pending = errorOf(client.signIn({ email: 'a', password: 'b' }));
      jest.advanceTimersByTime(1001);
      expect((await pending).code).toBe('unreachable');
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects a malformed success body', async () => {
    const { client } = setup(() => json(200, { user, tokens: { ...tokens, accessToken: '' } }));
    expect((await errorOf(client.signIn({ email: 'a', password: 'b' }))).code).toBe('server_error');
  });
});
