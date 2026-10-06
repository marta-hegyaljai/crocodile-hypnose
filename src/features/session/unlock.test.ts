import { deriveJourney } from '@/content/journey';
import { localContent } from '@/content/repository';
import { defaultProgress } from '@/services/progress/types';
import { markDone } from '@/services/progress/mergeProgress';

import { newlyUnlocked } from './unlock';

describe('newlyUnlocked', () => {
  it('names the stop a completion opened, and nothing for a replay', () => {
    const p0 = defaultProgress();
    const p1 = markDone(p0, 'sleep-1', 1);
    const j0 = deriveJourney(localContent, p0, { cautionMode: false });
    const j1 = deriveJourney(localContent, p1, { cautionMode: false });
    expect(newlyUnlocked(j0, j1)).toEqual(['sleep-2']);
    expect(newlyUnlocked(j1, j1)).toEqual([]);
  });
});
