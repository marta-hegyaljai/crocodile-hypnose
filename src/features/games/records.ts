import { useEffect } from 'react';
import { create } from 'zustand';

import type { KeyValueStorage } from '@/services/auth/storage';
import { appStorage } from '@/services/profile/asyncStorage';

import { GAME_IDS, resultValue, type GameId, type GameResult } from './catalog';

/** What the clearing shows per game: how often it was played and the best result. */
export interface GameRecord {
  plays: number;
  best: GameResult | null;
}

export type GameRecords = Record<GameId, GameRecord>;

export const emptyRecords = (): GameRecords =>
  Object.fromEntries(GAME_IDS.map((id) => [id, { plays: 0, best: null }])) as GameRecords;

/** Adds a finished game. Pure; plays only grow and the best only improves. */
export function recordPlay(records: GameRecords, result: GameResult): GameRecords {
  const current = records[result.gameId];
  const best =
    current.best && resultValue(current.best) >= resultValue(result) ? current.best : result;
  return { ...records, [result.gameId]: { plays: current.plays + 1, best } };
}

/** Two copies of the records (two tabs): the larger count and the better result win. */
export function mergeRecords(a: GameRecords, b: GameRecords): GameRecords {
  const out = emptyRecords();
  for (const id of GAME_IDS) {
    const x = a[id];
    const y = b[id];
    const best =
      x.best && y.best
        ? resultValue(x.best) >= resultValue(y.best)
          ? x.best
          : y.best
        : (x.best ?? y.best);
    out[id] = { plays: Math.max(x.plays, y.plays), best };
  }
  return out;
}

const isRecord = (v: unknown): v is GameRecord => {
  if (!v || typeof v !== 'object') return false;
  const r = v as { plays?: unknown; best?: unknown };
  return (
    typeof r.plays === 'number' &&
    Number.isInteger(r.plays) &&
    r.plays >= 0 &&
    (r.best === null || (!!r.best && typeof r.best === 'object'))
  );
};

export function parseRecords(raw: string | null): GameRecords {
  const out = emptyRecords();
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const id of GAME_IDS) {
      const r = parsed?.[id];
      if (isRecord(r) && (r.best === null || r.best.gameId === id)) out[id] = r;
    }
  } catch {
    // A damaged copy is just an empty record.
  }
  return out;
}

export const RECORDS_KEY = 'mhp.hypnose.games.v1';
const keyFor = (userId: string) => `${RECORDS_KEY}.${userId}`;

interface RecordsState {
  userId: string | null;
  records: GameRecords;
  loaded: boolean;
  load(userId: string): Promise<void>;
  record(result: GameResult): Promise<void>;
}

/**
 * Best results and times played per game, kept on this device per user (the server-side ledger
 * arrives with gamification). Loss-proof: a reload or a second tab merges rather than overwrites.
 */
export function createGameRecordsStore(storage: KeyValueStorage) {
  return create<RecordsState>()((set, get) => ({
    userId: null,
    records: emptyRecords(),
    loaded: false,
    async load(userId) {
      if (get().userId === userId && get().loaded) return;
      set({ userId, records: emptyRecords(), loaded: false });
      const raw = await storage.getItem(keyFor(userId)).catch(() => null);
      if (get().userId !== userId) return;
      set({ records: mergeRecords(get().records, parseRecords(raw)), loaded: true });
    },
    async record(result) {
      const { userId } = get();
      if (!userId) return;
      const key = keyFor(userId);
      // Merge with what is on the device right now, so another tab's plays are never dropped.
      const stored = parseRecords(await storage.getItem(key).catch(() => null));
      const next = recordPlay(mergeRecords(get().records, stored), result);
      set({ records: next });
      await storage.setItem(key, JSON.stringify(next)).catch(() => undefined);
    },
  }));
}

export const useGameRecordsStore = createGameRecordsStore(appStorage);

/** The signed-in user's game records, loading them on first use. */
export function useGameRecords(userId: string | null): GameRecords {
  const load = useGameRecordsStore((s) => s.load);
  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);
  return useGameRecordsStore((s) => s.records);
}
