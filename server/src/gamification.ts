/**
 * The server side of gamification: the points ledger is derived here from the stored events, the
 * server's content and the user's documents, with the shared rules in
 * `src/services/gamification/shared/rules.ts`. The client never sends points, stop types or amounts.
 */
import { serverContent } from './content.ts';
import { ApiError } from './errors.ts';
import type { AccountRepository, EventRecord, LedgerRecord } from './storage/repository.ts';
import {
  DECORATIONS,
  DEFAULT_WEEKLY_TARGET,
  deriveNewEntries,
  isGameKind,
  purchaseEntry,
  SLOTS,
  summarize,
  type ActivityEvent,
  type LedgerEntry,
} from '../../src/services/gamification/shared/rules.ts';

export const HABITAT_KIND = 'habitat';

function activities(events: EventRecord[]): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  for (const { data } of events) {
    if (data.type === 'sessionCompleted' && typeof data.stopId === 'string') {
      out.push({
        id: String(data.id),
        type: 'sessionCompleted',
        stopId: data.stopId,
        at: Number(data.at),
      });
    } else if (data.type === 'gameCompleted' && isGameKind(data.gameId)) {
      out.push({
        id: String(data.id),
        type: 'gameCompleted',
        gameId: data.gameId,
        at: Number(data.at),
      });
    }
  }
  return out;
}

const asEntries = (ledger: LedgerRecord[]) => ledger as LedgerEntry[];

/** The user's choices the ledger depends on (weekly goal, onboarding reward). */
async function context(repo: AccountRepository, userId: string) {
  const [gamification, onboarding] = await Promise.all([
    repo.getDocument(userId, 'gamification'),
    repo.getDocument(userId, 'onboarding'),
  ]);
  return {
    weeklyTarget: Number(gamification?.data.weeklyTarget ?? DEFAULT_WEEKLY_TARGET),
    timeZone: typeof gamification?.data.timeZone === 'string' ? gamification.data.timeZone : null,
    onboardingRewarded: onboarding?.data.rewardGranted === true,
  };
}

/**
 * Brings the ledger up to date with what is stored and returns it. Safe to call any time: it only
 * adds rewards whose key is missing.
 */
export async function syncLedger(
  repo: AccountRepository,
  user: { id: string; createdAt: number },
  now: number,
): Promise<LedgerRecord[]> {
  const ctx = await context(repo, user.id);
  const content = serverContent();
  return repo.updateLedger(
    user.id,
    ({ events, ledger }) =>
      deriveNewEntries({
        events: activities(events),
        ledger: asEntries(ledger),
        content,
        accountCreatedAt: user.createdAt,
        ...ctx,
      }),
    now,
  );
}

/** Buys a decoration once: idempotent, never below zero, locked items stay locked. */
export async function purchase(
  repo: AccountRepository,
  user: { id: string; createdAt: number },
  itemId: string,
  now: number,
): Promise<LedgerRecord[]> {
  await syncLedger(repo, user, now);
  const ctx = await context(repo, user.id);
  const content = serverContent();
  return repo.updateLedger(
    user.id,
    ({ events, ledger }) => {
      const spend = purchaseEntry(asEntries(ledger), itemId, now);
      if (spend && 'refused' in spend) {
        if (spend.refused === 'unknown') {
          throw new ApiError(400, 'invalid_request', 'No such decoration.', {
            itemId: 'invalid_request',
          });
        }
        throw spend.refused === 'locked'
          ? new ApiError(409, 'locked', 'This decoration is not unlocked yet.')
          : new ApiError(409, 'insufficient_points', 'Not enough points.');
      }
      if (!spend) return [];
      // Owning a first decoration may earn a badge: derive with the purchase included.
      const after = [...asEntries(ledger), spend];
      const more = deriveNewEntries({
        events: activities(events),
        ledger: after,
        content,
        accountCreatedAt: user.createdAt,
        ...ctx,
      });
      return [spend, ...more];
    },
    now,
  );
}

export function pointsWire(ledger: LedgerRecord[]) {
  return summarize(asEntries(ledger));
}

/* ---------- habitat placement ---------- */

const ITEM_IDS = DECORATIONS.map((d) => d.id);

export const habitatBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'updatedAt', 'slots'],
  properties: {
    version: { type: 'integer', const: 1 },
    updatedAt: { type: 'integer', minimum: 0 },
    slots: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        SLOTS.map((s) => [s.id, { type: ['string', 'null'], enum: [...ITEM_IDS, null] }]),
      ),
    },
  },
} as const;

/**
 * What may be stored of a placement: only owned items, each in a slot of its kind and in one
 * slot at most. Anything else is left empty rather than refused, so the app's sync never stalls.
 */
export function cleanPlacement(
  slots: Record<string, unknown>,
  owned: Set<string>,
): Record<string, string | null> {
  const used = new Set<string>();
  const out: Record<string, string | null> = {};
  for (const slot of SLOTS) {
    const itemId = slots[slot.id];
    const item = typeof itemId === 'string' ? DECORATIONS.find((d) => d.id === itemId) : undefined;
    if (item && item.slot === slot.kind && owned.has(item.id) && !used.has(item.id)) {
      used.add(item.id);
      out[slot.id] = item.id;
    } else {
      out[slot.id] = null;
    }
  }
  return out;
}
