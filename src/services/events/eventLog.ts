import { PartialPush } from '@/services/profile/documentStore';

import type { Logged, EventLogDoc } from './types';

/**
 * One append-only stream on the device, kept as a synced document (`createDocumentStore` gives
 * it offline storage, other-tab following, retries and the "read the server first" rule):
 * - the device copy holds every event, `confirmed` once the server stored it;
 * - a read takes in the server's events, a push sends the unconfirmed ones;
 * - two copies merge as the union by id, the server's (confirmed) version winning, so a repeated
 *   event can never count twice and nothing recorded offline is ever lost.
 */

export function emptyLog<T>(updatedAt = 0): EventLogDoc<T> {
  return { version: 1, updatedAt, items: {} };
}

function sorted<T>(items: Record<string, Logged<T>>): Record<string, Logged<T>> {
  return Object.fromEntries(
    Object.keys(items)
      .sort()
      .map((id) => [id, items[id]!]),
  );
}

export function mergeLogs<T>(a: EventLogDoc<T>, b: EventLogDoc<T>): EventLogDoc<T> {
  const items: Record<string, Logged<T>> = { ...a.items };
  for (const [id, item] of Object.entries(b.items)) {
    const mine = items[id];
    // The server's verdict (e.g. on a first-time claim) replaces the device's.
    if (!mine || (!mine.confirmed && item.confirmed)) items[id] = item;
  }
  return { version: 1, updatedAt: Math.max(a.updatedAt, b.updatedAt), items: sorted(items) };
}

/** Records an event. An id already in the log changes nothing (the same doc comes back). */
export function addToLog<T extends { id: string }>(doc: EventLogDoc<T>, item: T): EventLogDoc<T> {
  if (doc.items[item.id]) return doc;
  return { ...doc, items: sorted({ ...doc.items, [item.id]: item as Logged<T> }) };
}

/** The events not yet stored by the server. */
export function pendingOf<T>(doc: EventLogDoc<T>): T[] {
  return Object.values(doc.items)
    .filter((item) => !item.confirmed)
    .map((item) => {
      const { confirmed: _confirmed, ...rest } = item as Logged<T> & Record<string, unknown>;
      return rest as T;
    });
}

/** The log's events, oldest first. */
export function eventsOf<T extends { at: number; id: string }>(doc: EventLogDoc<T>): Logged<T>[] {
  return Object.values(doc.items).sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : 1));
}

/** Server events (already validated) as a confirmed log. */
export function confirmedLog<T extends { id: string }>(items: T[]): EventLogDoc<T> {
  const doc = emptyLog<T>();
  for (const item of items) doc.items[item.id] = { ...item, confirmed: true } as Logged<T>;
  return { ...doc, items: sorted(doc.items) };
}

export function isEventLogDoc<T>(
  validateItem: (value: unknown) => value is T,
): (value: unknown) => value is EventLogDoc<T> {
  return (value: unknown): value is EventLogDoc<T> => {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    if (v.version !== 1 || typeof v.updatedAt !== 'number') return false;
    const items = v.items;
    if (!items || typeof items !== 'object' || Array.isArray(items)) return false;
    return Object.entries(items as Record<string, unknown>).every(
      ([id, item]) => validateItem(item) && (item as { id: string }).id === id,
    );
  };
}

/** Events per request the server accepts. */
export const EVENTS_PER_REQUEST = 50;

/**
 * Settles events the server refused for good: they are marked done so they are never sent again
 * (and stay on the device, so nothing is silently lost and other copies merge as before).
 */
export function settleRefused<T>(doc: EventLogDoc<T>, ids: ReadonlySet<string>): EventLogDoc<T> {
  if (ids.size === 0) return doc;
  const items = { ...doc.items };
  for (const id of ids) if (items[id]) items[id] = { ...items[id], confirmed: true };
  return { ...doc, items };
}

/**
 * Sends a log's unconfirmed events in batches and answers the log as the server stored it (the
 * shape `createDocumentStore`'s push expects).
 *
 * When the server refuses a batch (`isRefused`: the events themselves, not the connection), the
 * batch is sent again one event at a time and only the events refused on their own are dropped,
 * so one bad event never stops the rest of the stream from syncing.
 *
 * Any other failure (a rate limit, the connection) stops the push, and is thrown as a
 * `PartialPush` when something was learned first: the batches the server stored and the events it
 * refused. The retry then starts from there instead of sending everything again.
 */
export async function pushLog<T extends { id: string }>(
  doc: EventLogDoc<T>,
  send: (items: T[]) => Promise<T[]>,
  isRefused: (error: unknown) => boolean = () => false,
): Promise<EventLogDoc<T>> {
  const pending = pendingOf(doc);
  let result = doc;
  const refused = new Set<string>();
  try {
    for (let i = 0; i < pending.length; i += EVENTS_PER_REQUEST) {
      const batch = pending.slice(i, i + EVENTS_PER_REQUEST);
      try {
        result = mergeLogs(result, confirmedLog(await send(batch)));
      } catch (err) {
        if (!isRefused(err)) throw err;
        for (const item of batch) {
          try {
            result = mergeLogs(result, confirmedLog(await send([item])));
          } catch (one) {
            if (!isRefused(one)) throw one;
            refused.add(item.id);
          }
        }
      }
    }
  } catch (err) {
    const learned = settleRefused(result, refused);
    if (learned === doc) throw err;
    throw new PartialPush(err, learned);
  }
  return settleRefused(result, refused);
}
