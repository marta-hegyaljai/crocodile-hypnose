import { palette } from '@/theme';
import type { IconName } from '@/ui';

import type { GameId } from './catalog';

/** The glyph and tint each game wears on the clearing cards and on its intro and end cards. */
export const GAME_ICONS: Record<GameId, IconName> = {
  stillness: 'drop',
  firefly: 'sparkle',
  breathing: 'leaf',
};

export const GAME_TINTS: Record<GameId, { bg: string; fg: string }> = {
  stillness: { bg: palette.shallows, fg: palette.tealDeep },
  firefly: { bg: palette.tealNight, fg: palette.amberGlow },
  breathing: { bg: palette.leafLight, fg: palette.crocGreenDark },
};
