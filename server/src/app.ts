import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

import { createAuthService } from './auth-service.ts';
import type { ServerConfig } from './config.ts';
import { ApiError, type ErrorBody, type ErrorCode } from './errors.ts';
import { authRoutes } from './routes/auth.ts';
import { gamificationRoutes } from './routes/gamification.ts';
import { meRoutes } from './routes/me.ts';
import { createAccessTokenSigner } from './tokens.ts';
import type { AccountRepository } from './storage/repository.ts';

export interface BuildAppOptions {
  config: ServerConfig;
  repo: AccountRepository;
  logger?: FastifyServerOptions['logger'];
  now?: () => number;
}

function fieldName(error: FastifyError): Record<string, ErrorCode> | undefined {
  const fields: Record<string, ErrorCode> = {};
  for (const v of error.validation ?? []) {
    const missing = (v.params as { missingProperty?: string }).missingProperty;
    const path = missing ?? v.instancePath.replace(/^\//, '').split('/')[0];
    if (path) fields[path] = 'invalid_request';
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

/** Builds the HTTP app. Storage and config are injected so tests can use an in-memory database. */
export async function buildApp({
  config,
  repo,
  logger,
  now,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger ?? {
      level: config.logLevel,
      redact: ['req.headers.authorization'],
    },
    bodyLimit: 16 * 1024,
    // Fastify accepts a hop count at runtime; its types only list boolean/string/list/function.
    trustProxy: config.trustProxy as boolean | string,
    // Report every invalid field at once, never coerce types (a number is not an email) and refuse
    // unknown fields where a schema forbids them instead of silently dropping them.
    ajv: { customOptions: { allErrors: true, coerceTypes: false, removeAdditional: false } },
  });

  const signer = createAccessTokenSigner({
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    ttlSeconds: config.accessTokenTtlSeconds,
  });
  const service = createAuthService({
    repo,
    signer,
    refreshTokenTtlSeconds: config.refreshTokenTtlSeconds,
    refreshReuseGraceSeconds: config.refreshReuseGraceSeconds,
    passwordResetTtlSeconds: config.passwordResetTtlSeconds,
    resetLinkBase: config.resetLinkBase,
    scrypt: config.scrypt,
    now,
    onPasswordResetLink: ({ email, clientId, link }) => {
      // Dev only: no mail is sent. The link is logged so it can be followed by hand.
      app.log.info(
        { email, clientId, resetLink: link },
        'password reset requested (dev: not emailed)',
      );
    },
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization'],
    maxAge: 600,
  });

  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_req, context) =>
      new ApiError(429, 'rate_limited', `Too many attempts. Try again in ${context.after}.`),
  });

  app.setErrorHandler((error: FastifyError | ApiError, req, reply) => {
    if (error instanceof ApiError) {
      if (error.statusCode === 429) reply.header('retry-after', reply.getHeader('retry-after'));
      return reply.code(error.statusCode).send(error.toBody());
    }
    if (error.validation) {
      const body: ErrorBody = {
        error: {
          code: 'invalid_request',
          message: 'The request is not valid.',
          fields: fieldName(error),
        },
      };
      return reply.code(400).send(body);
    }
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      // Fastify's own client errors: malformed JSON, wrong content type, body too large.
      const body: ErrorBody = { error: { code: 'invalid_request', message: error.message } };
      return reply.code(status).send(body);
    }
    req.log.error({ err: error }, 'unhandled error');
    const body: ErrorBody = { error: { code: 'internal', message: 'Something went wrong.' } };
    return reply.code(500).send(body);
  });

  app.setNotFoundHandler((_req, reply) => {
    const body: ErrorBody = { error: { code: 'not_found', message: 'Not found.' } };
    return reply.code(404).send(body);
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, {
    service,
    rateLimit: { max: config.authRateLimit.max, timeWindow: config.authRateLimit.windowMs },
    refreshRateLimit: {
      max: config.refreshRateLimit.max,
      timeWindow: config.refreshRateLimit.windowMs,
    },
  });
  await app.register(meRoutes, {
    service,
    now,
    eventsRateLimit: {
      max: config.eventsRateLimit.max,
      timeWindow: config.eventsRateLimit.windowMs,
    },
    // Account deletion checks the password: guessing is limited like a sign-in.
    rateLimit: { max: config.authRateLimit.max, timeWindow: config.authRateLimit.windowMs },
  });
  await app.register(gamificationRoutes, {
    service,
    now,
    devHooks: config.devHooks,
    readRateLimit: { max: config.readRateLimit.max, timeWindow: config.readRateLimit.windowMs },
  });

  return app;
}
