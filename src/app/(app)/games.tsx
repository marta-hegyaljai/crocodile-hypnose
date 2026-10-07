import { router } from 'expo-router';
import React, { useCallback } from 'react';

import { t } from '@/copy';
import { GamesClearing, useGameRecords, type GameId } from '@/features/games';
import { InactiveGuard } from '@/features/layout/InactiveGuard';
import { useTapShield } from '@/features/layout/TapShield';
import { useAuth } from '@/services/auth';
import { useProfile } from '@/services/profile';

/** The games clearing: the three mini-games, how often they were played and the best results. */
export default function GamesTab() {
  const shield = useTapShield();
  const userId = useAuth((s) => s.user?.id ?? null);
  const crocName = useProfile((s) => s.settings.crocName) ?? t('croc.defaultName');
  const records = useGameRecords(userId);
  const open = useCallback(
    (gameId: GameId) => {
      shield();
      router.push({ pathname: '/game/[gameId]', params: { gameId } });
    },
    [shield],
  );
  return (
    <InactiveGuard>
      <GamesClearing records={records} crocName={crocName} onOpen={open} />
    </InactiveGuard>
  );
}
