/**
 * Test double for the gamification transport: an in-memory server that runs the shared rules on
 * the profile fake's stored events, like the dev server does.
 */
import { AuthError } from '@/services/auth/types';
import { PurchaseRefused, type GamificationClient } from '@/services/gamification/client';
import { appContentMeta } from '@/services/gamification/derive';
import {
  deriveNewEntries,
  purchaseEntry,
  summarize,
  type ActivityEvent,
  type LedgerEntry,
} from '@/services/gamification/shared/rules';
import type { GamificationDoc, HabitatDoc } from '@/services/gamification/types';

import type { FakeProfileClient } from './fakeProfile';

export interface FakeGamificationClient extends GamificationClient {
  ledger: LedgerEntry[];
  goal: GamificationDoc | null;
  habitat: HabitatDoc | null;
  failAll(error: AuthError | null): void;
  /** Adds calm seconds (the dev hook). */
  addSeconds(seconds: number, at?: number): void;
}

export function createFakeGamificationClient(
  options: { profile?: FakeProfileClient; user?: string; createdAt?: number } = {},
): FakeGamificationClient {
  const user = options.user ?? 'user-1';
  let failure: AuthError | null = null;
  const fake: FakeGamificationClient = {
    ledger: [],
    goal: null,
    habitat: null,
    failAll(error) {
      failure = error;
    },
    addSeconds(seconds, at = Date.now()) {
      fake.ledger.push({
        key: `dev:${fake.ledger.length}`,
        kind: 'dev',
        points: 0,
        seconds,
        at,
        ref: 'dev',
      });
    },
    async points() {
      sync();
      return summarize(fake.ledger);
    },
    async purchase(itemId) {
      sync();
      const spend = purchaseEntry(fake.ledger, itemId, Date.now());
      if (spend && 'refused' in spend) {
        if (spend.refused === 'unknown') throw new AuthError('invalid_request');
        throw new PurchaseRefused(spend.refused === 'locked' ? 'locked' : 'insufficient');
      }
      if (spend) fake.ledger.push(spend);
      sync();
      return summarize(fake.ledger);
    },
    async getGoal() {
      pass();
      return fake.goal;
    },
    async putGoal(doc) {
      pass();
      fake.goal = doc;
      return doc;
    },
    async getHabitat() {
      pass();
      return fake.habitat;
    },
    async putHabitat(doc) {
      pass();
      fake.habitat = doc;
      return doc;
    },
  };
  function pass() {
    if (failure) throw failure;
  }
  function sync() {
    pass();
    const events = (options.profile?.streams.get(`${user}:events`) ?? []) as ActivityEvent[];
    fake.ledger.push(
      ...deriveNewEntries({
        events,
        ledger: fake.ledger,
        content: appContentMeta,
        weeklyTarget: fake.goal?.weeklyTarget ?? 4,
        timeZone: fake.goal?.timeZone ?? null,
        onboardingRewarded: false,
        accountCreatedAt: options.createdAt ?? 0,
      }),
    );
  }
  return fake;
}
