import type { CopyKey } from '@/copy';
import type { Stop } from '@/content/types';
import type { Atmosphere } from '@/theme';

export const GAME_IDS = ['stillness', 'firefly', 'breathing'] as const;
export type GameId = (typeof GAME_IDS)[number];

export interface GameDef {
  id: GameId;
  titleKey: CopyKey;
  howToKey: CopyKey;
  skillKey: CopyKey;
  /** Daylight for the lively games, Night River for the eye-fixation game. */
  atmosphere: Atmosphere;
  /** Nominal length in seconds (shown on the clearing). */
  durationSec: number;
}

export const GAMES: readonly GameDef[] = [
  {
    id: 'stillness',
    titleKey: 'games.titles.stillness',
    howToKey: 'games.howTo.stillness',
    skillKey: 'games.skill.stillness',
    atmosphere: 'daylight',
    durationSec: 90,
  },
  {
    id: 'firefly',
    titleKey: 'games.titles.firefly',
    howToKey: 'games.howTo.firefly',
    skillKey: 'games.skill.firefly',
    atmosphere: 'night',
    durationSec: 100,
  },
  {
    id: 'breathing',
    titleKey: 'games.titles.breathing',
    howToKey: 'games.howTo.breathing',
    skillKey: 'games.skill.breathing',
    atmosphere: 'daylight',
    durationSec: 80,
  },
];

export const gameById = (id: string): GameDef | undefined => GAMES.find((g) => g.id === id);

export const isGameId = (id: string): id is GameId => (GAME_IDS as readonly string[]).includes(id);

/** The game a `game` stop opens: its `mediaRef` is `game:<id>`. Undefined for other stops. */
export function gameIdOfStop(stop: Pick<Stop, 'type' | 'mediaRef'>): GameId | undefined {
  if (stop.type !== 'game') return undefined;
  const id = stop.mediaRef.startsWith('game:') ? stop.mediaRef.slice('game:'.length) : '';
  return isGameId(id) ? id : undefined;
}

/** What a finished game reports to the shell (and later to the reward event). */
export type GameResult =
  | {
      gameId: 'stillness';
      score: number;
      /** Samples taken: 0 when nothing was ever measured. */ samples?: number;
    }
  | { gameId: 'firefly'; rounds: number; total: number }
  | { gameId: 'breathing'; breaths: number };

/** Fewest breaths that count as having played Breathing (a few slow ones). */
export const MIN_BREATHS = 2;
/** Fewest stillness samples (a few seconds of resting) that count as having played Stillness. */
export const MIN_STILLNESS_SAMPLES = 20;

/**
 * Whether the play was real: a game left idle runs to its end but must not count (no record, no
 * points, no stop completed). Firefly asks for nothing but watching, so it always counts.
 */
export function isEngaged(result: GameResult): boolean {
  switch (result.gameId) {
    case 'stillness':
      return result.samples === undefined || result.samples >= MIN_STILLNESS_SAMPLES;
    case 'firefly':
      return true;
    case 'breathing':
      return result.breaths >= MIN_BREATHS;
  }
}

/** The number a result is ranked by (higher is better), for "best" on the clearing. */
export function resultValue(result: GameResult): number {
  switch (result.gameId) {
    case 'stillness':
      return result.score;
    case 'firefly':
      return result.rounds;
    case 'breathing':
      return result.breaths;
  }
}
