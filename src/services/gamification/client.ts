import { AuthError } from '@/services/auth/types';
import { createJsonRequest, type JsonRequestOptions } from '@/services/http/jsonRequest';

import type { PointsSummary } from './shared/rules';
import {
  isGamificationDoc,
  isHabitatDoc,
  isPointsSummary,
  type GamificationDoc,
  type HabitatDoc,
} from './types';

export type PurchaseRefusal = 'insufficient' | 'locked';

/** Thrown by `purchase` when the server says no (not enough points, still locked). */
export class PurchaseRefused extends Error {
  constructor(readonly reason: PurchaseRefusal) {
    super(reason);
    this.name = 'PurchaseRefused';
  }
}

/**
 * Transport for gamification: the server's points summary, buying decorations, and the two synced
 * documents. Every call throws AuthError (offline, unreachable, unauthorized, invalid_request...).
 */
export interface GamificationClient {
  points(accessToken: string): Promise<PointsSummary>;
  /** Buys a decoration; resolves the summary afterwards. Throws PurchaseRefused when refused. */
  purchase(itemId: string, accessToken: string): Promise<PointsSummary>;
  getGoal(accessToken: string): Promise<GamificationDoc | null>;
  putGoal(doc: GamificationDoc, accessToken: string): Promise<GamificationDoc>;
  getHabitat(accessToken: string): Promise<HabitatDoc | null>;
  putHabitat(doc: HabitatDoc, accessToken: string): Promise<HabitatDoc>;
}

function strip<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  const { storedAt: _storedAt, ...rest } = raw as Record<string, unknown>;
  return rest as T;
}

function summaryOf(body: unknown): PointsSummary {
  const raw = (body as { points?: unknown } | undefined)?.points;
  if (!isPointsSummary(raw)) throw new AuthError('server_error', { message: 'malformed points' });
  return raw;
}

export function createHttpGamificationClient(options: JsonRequestOptions): GamificationClient {
  const request = createJsonRequest(options);
  return {
    async points(accessToken) {
      return summaryOf(await request('GET', '/me/points', { accessToken }));
    },
    async purchase(itemId, accessToken) {
      try {
        return summaryOf(
          await request('POST', '/me/habitat/purchases', { body: { itemId }, accessToken }),
        );
      } catch (err) {
        // By the server's error code, never by its wording.
        if (err instanceof AuthError && err.status === 409) {
          if (err.code === 'locked') throw new PurchaseRefused('locked');
          if (err.code === 'insufficient_points') throw new PurchaseRefused('insufficient');
        }
        throw err;
      }
    },
    async getGoal(accessToken) {
      const doc = strip<GamificationDoc>(
        ((await request('GET', '/me/gamification', { accessToken })) as Record<string, unknown>)
          ?.gamification,
      );
      return doc && isGamificationDoc(doc) ? doc : null;
    },
    async putGoal(doc, accessToken) {
      const body = await request('PUT', '/me/gamification', { body: doc, accessToken });
      const stored = strip<GamificationDoc>((body as Record<string, unknown>)?.gamification);
      if (!stored || !isGamificationDoc(stored)) {
        throw new AuthError('server_error', { message: 'malformed gamification answer' });
      }
      return stored;
    },
    async getHabitat(accessToken) {
      const body = await request('GET', '/me/habitat', { accessToken });
      const doc = strip<HabitatDoc>((body as Record<string, unknown>)?.habitat);
      return doc && isHabitatDoc(doc) ? doc : null;
    },
    async putHabitat(doc, accessToken) {
      const body = await request('PUT', '/me/habitat', { body: doc, accessToken });
      const stored = strip<HabitatDoc>((body as Record<string, unknown>)?.habitat);
      if (!stored || !isHabitatDoc(stored)) {
        throw new AuthError('server_error', { message: 'malformed habitat answer' });
      }
      return stored;
    },
  };
}
