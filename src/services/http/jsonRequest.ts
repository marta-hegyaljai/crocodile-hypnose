import { AuthError, type AuthErrorCode } from '@/services/auth/types';

export interface JsonRequestOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  /** Abort a request after this long and report the server as unreachable. */
  timeoutMs?: number;
  /** True when the device knows it has no connection (web: navigator.onLine). */
  isOffline?: () => boolean;
}

export interface JsonRequestInit {
  body?: unknown;
  accessToken?: string;
}

export type JsonMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Error codes the dev server sends that the app shows as they are. */
const KNOWN_CODES: readonly AuthErrorCode[] = [
  'invalid_credentials',
  'email_taken',
  'invalid_email',
  'weak_password',
  'invalid_display_name',
  'invalid_request',
  'invalid_reset_token',
  'unauthorized',
  'rate_limited',
  'insufficient_points',
  'locked',
];

export function webIsOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Maps a non-2xx answer (or a malformed one) to an AuthError with a known code. */
export function errorFromResponse(res: Response, body: unknown): AuthError {
  const status = res.status;
  if (status >= 500 || body === undefined) {
    // 502/503/504 come from proxies in front of a server that is down.
    return new AuthError(
      status === 502 || status === 503 || status === 504 ? 'unreachable' : 'server_error',
      { status },
    );
  }
  const error = (
    body as { error?: { code?: string; message?: string; fields?: Record<string, string> } }
  ).error;
  const raw = error?.code ?? '';
  let code: AuthErrorCode;
  if (raw === 'invalid_refresh_token' || raw === 'refresh_token_reused') code = 'session_ended';
  else if ((KNOWN_CODES as readonly string[]).includes(raw)) code = raw as AuthErrorCode;
  else if (status === 401) code = 'unauthorized';
  else if (status === 429) code = 'rate_limited';
  else code = 'unknown';
  const fields: Record<string, AuthErrorCode> = {};
  for (const [field, value] of Object.entries(error?.fields ?? {})) {
    fields[field] = (KNOWN_CODES as readonly string[]).includes(value)
      ? (value as AuthErrorCode)
      : 'invalid_request';
  }
  const retryAfter = Number(res.headers.get('retry-after'));
  return new AuthError(code, {
    status,
    message: error?.message,
    fields,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  });
}

/**
 * A JSON-over-HTTP request function for the dev server's conventions: JSON bodies, a bearer
 * token, `{ error: { code } }` answers, 204 for no content. Network-level failures become
 * `offline` or `unreachable`; the timeout counts as unreachable.
 */
export function createJsonRequest(options: JsonRequestOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? 15_000;
  const isOffline = options.isOffline ?? webIsOffline;
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  return async function request<T>(
    method: JsonMethod,
    path: string,
    init: JsonRequestInit = {},
  ): Promise<T | undefined> {
    if (isOffline()) throw new AuthError('offline');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      const headers: Record<string, string> = { accept: 'application/json' };
      if (init.body !== undefined) headers['content-type'] = 'application/json';
      if (init.accessToken) headers.authorization = `Bearer ${init.accessToken}`;
      res = await doFetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch {
      // fetch only rejects for network-level failures (and our timeout abort).
      throw new AuthError(isOffline() ? 'offline' : 'unreachable');
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 204) return undefined;
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    if (res.ok) {
      if (body === undefined) throw new AuthError('server_error', { status: res.status });
      return body as T;
    }
    throw errorFromResponse(res, body);
  };
}
