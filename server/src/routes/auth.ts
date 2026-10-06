import type { FastifyInstance } from 'fastify';

import type { AuthService } from '../auth-service.ts';
import { isClientId, type ClientId } from '../clients.ts';
import { errors } from '../errors.ts';

// Structural checks only (types and generous size caps). The service applies the real rules
// (email format, password length, name length) and reports them with specific codes.
const clientId = { type: 'string', maxLength: 64 } as const;
const email = { type: 'string', maxLength: 512 } as const;
const password = { type: 'string', maxLength: 1024 } as const;
const refreshToken = { type: 'string', minLength: 1, maxLength: 512 } as const;

function client(value: string): ClientId {
  if (!isClientId(value)) throw errors.unknownClient();
  return value;
}

export interface AuthRouteOptions {
  service: AuthService;
  rateLimit: { max: number; timeWindow: number };
  refreshRateLimit: { max: number; timeWindow: number };
}

export async function authRoutes(
  app: FastifyInstance,
  { service, rateLimit, refreshRateLimit }: AuthRouteOptions,
) {
  const limited = { rateLimit };

  app.post<{
    Body: { email: string; password: string; displayName?: string | null; clientId: string };
  }>(
    '/auth/signup',
    {
      config: limited,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'clientId'],
          properties: {
            email,
            password,
            displayName: { type: ['string', 'null'], maxLength: 512 },
            clientId,
          },
        },
      },
    },
    async (req, reply) => {
      const result = await service.signUp({ ...req.body, clientId: client(req.body.clientId) });
      return reply.code(201).send(result);
    },
  );

  app.post<{ Body: { email: string; password: string; clientId: string } }>(
    '/auth/signin',
    {
      config: limited,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'clientId'],
          properties: { email, password, clientId },
        },
      },
    },
    async (req) => service.signIn({ ...req.body, clientId: client(req.body.clientId) }),
  );

  app.post<{ Body: { refreshToken: string; clientId: string } }>(
    '/auth/refresh',
    {
      config: { rateLimit: refreshRateLimit },
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken', 'clientId'],
          properties: { refreshToken, clientId },
        },
      },
    },
    async (req) => service.refresh({ ...req.body, clientId: client(req.body.clientId) }),
  );

  app.post<{ Body: { refreshToken: string } }>(
    '/auth/signout',
    {
      config: limited,
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken, clientId },
        },
      },
    },
    async (req, reply) => {
      await service.signOut(req.body);
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { email: string; clientId: string } }>(
    '/auth/password-reset/request',
    {
      config: limited,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'clientId'],
          properties: { email, clientId },
        },
      },
    },
    async (req, reply) => {
      await service.requestPasswordReset({ ...req.body, clientId: client(req.body.clientId) });
      return reply.code(202).send({ status: 'accepted' });
    },
  );

  app.post<{ Body: { token: string; password: string } }>(
    '/auth/password-reset/confirm',
    {
      config: limited,
      schema: {
        body: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string', minLength: 1, maxLength: 512 },
            password,
            clientId,
          },
        },
      },
    },
    async (req, reply) => {
      await service.confirmPasswordReset(req.body);
      return reply.code(204).send();
    },
  );
}
