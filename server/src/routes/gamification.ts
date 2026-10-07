import { randomUUID } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { AuthService } from '../auth-service.ts';
import { MAX_CLOCK_SKEW_MS } from '../documents.ts';
import { errors } from '../errors.ts';
import {
  cleanPlacement,
  habitatBodySchema,
  HABITAT_KIND,
  pointsWire,
  purchase,
  syncLedger,
} from '../gamification.ts';

function bearer(req: FastifyRequest): string {
  const header = req.headers.authorization;
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  if (!match?.[1]) throw errors.unauthorized();
  return match[1];
}

export interface GamificationRouteOptions {
  service: AuthService;
  now?: () => number;
  devHooks?: boolean;
}

/**
 * Points, habitat and (dev only) shortcuts:
 * - `GET /me/points`: the ledger brought up to date, as balance, calm time, badges, owned items
 *   and the latest entries.
 * - `POST /me/habitat/purchases {itemId}`: buys a decoration (idempotent, never below zero).
 * - `GET/PUT /me/habitat`: where the owned decorations are placed (last write wins).
 * - `POST /me/dev/calm {seconds}`: adds calm time to see the croc grow (DEV_HOOKS=1 only).
 */
export async function gamificationRoutes(
  app: FastifyInstance,
  { service, now = Date.now, devHooks = false }: GamificationRouteOptions,
) {
  const repo = service.repo;

  app.get('/me/points', async (req) => {
    const { user } = await service.authenticate(bearer(req));
    return { points: pointsWire(await syncLedger(repo, user, now())) };
  });

  app.post<{ Body: { itemId: string } }>(
    '/me/habitat/purchases',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['itemId'],
          properties: { itemId: { type: 'string', minLength: 1, maxLength: 64 } },
        },
      },
    },
    async (req) => {
      const { user } = await service.authenticate(bearer(req));
      return { points: pointsWire(await purchase(repo, user, req.body.itemId, now())) };
    },
  );

  const habitatWire = async (userId: string) => {
    const doc = await repo.getDocument(userId, HABITAT_KIND);
    return doc ? { ...doc.data, storedAt: doc.storedAt } : null;
  };

  app.get('/me/habitat', async (req) => {
    const { user } = await service.authenticate(bearer(req));
    const owned = pointsWire(await syncLedger(repo, user, now())).owned;
    return { habitat: await habitatWire(user.id), owned };
  });

  app.put<{ Body: { version: 1; updatedAt: number; slots: Record<string, unknown> } }>(
    '/me/habitat',
    { schema: { body: habitatBodySchema } },
    async (req) => {
      const { user } = await service.authenticate(bearer(req));
      const at = now();
      const owned = new Set(
        pointsWire(await syncLedger(repo, user, at)).owned.map((o) => o.itemId),
      );
      const updatedAt = Math.min(req.body.updatedAt, at + MAX_CLOCK_SKEW_MS, at);
      const data = { version: 1, updatedAt, slots: cleanPlacement(req.body.slots, owned) };
      await repo.putDocument({
        userId: user.id,
        kind: HABITAT_KIND,
        version: 1,
        data,
        updatedAt,
        storedAt: at,
      });
      return { habitat: await habitatWire(user.id), owned: [...owned] };
    },
  );

  if (devHooks) {
    app.post<{ Body: { seconds: number } }>(
      '/me/dev/calm',
      {
        schema: {
          body: {
            type: 'object',
            additionalProperties: false,
            required: ['seconds'],
            properties: { seconds: { type: 'integer', minimum: 1, maximum: 1_000_000 } },
          },
        },
      },
      async (req) => {
        const { user } = await service.authenticate(bearer(req));
        const at = now();
        await repo.updateLedger(
          user.id,
          () => [
            {
              key: `dev:${randomUUID()}`,
              kind: 'dev',
              points: 0,
              seconds: req.body.seconds,
              ref: 'dev',
              at,
            },
          ],
          at,
        );
        return { points: pointsWire(await syncLedger(repo, user, at)) };
      },
    );
  }
}
