import { t } from '@/copy';

import type { GameResult } from './catalog';

/** The one-line result shown on the end card and as "best" on the clearing. */
export function resultLabel(result: GameResult): string {
  switch (result.gameId) {
    case 'stillness':
      return t('games.result.stillness', { n: result.score });
    case 'firefly':
      return t('games.result.firefly', { n: result.rounds, total: result.total });
    case 'breathing':
      return result.breaths === 1
        ? t('games.result.breathingOne')
        : t('games.result.breathing', { n: result.breaths });
  }
}
