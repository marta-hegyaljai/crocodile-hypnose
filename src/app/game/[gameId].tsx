import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import {
  BreathingGame,
  FireflyGame,
  GameShell,
  StillnessGame,
  gameById,
  resultLabel,
  useGameRecords,
  useGameRecordsStore,
  type GameId,
  type GameProps,
  type GameResult,
} from '@/features/games';
import { useJourney } from '@/features/home/useJourney';
import { useAuth } from '@/services/auth';
import { useProfile } from '@/services/profile';
import { markDone, markStarted } from '@/services/progress/mergeProgress';
import { space } from '@/theme';
import { Button, Screen, Text } from '@/ui';

const GAME_SCREENS: Record<GameId, React.ComponentType<GameProps>> = {
  stillness: StillnessGame,
  firefly: FireflyGame,
  breathing: BreathingGame,
};

const back = () => (router.canGoBack() ? router.back() : router.replace('/games'));

/**
 * A mini-game, opened from the games clearing (`/game/firefly`) or from a map stop of type
 * `game` (`/game/firefly?stopId=sleep-7`). Playing it through records the play on this device
 * and, for a stop, marks that stop done; the reward moment is wired in by the sessions step.
 */
export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const { gameId, stopId } = useLocalSearchParams<{ gameId: string; stopId?: string }>();
  const game = gameId ? gameById(gameId) : undefined;
  const userId = useAuth((s) => s.user?.id ?? null);
  const crocName = useProfile((s) => s.settings.crocName) ?? t('croc.defaultName');
  const updateProgress = useProfile((s) => s.updateProgress);
  const record = useGameRecordsStore((s) => s.record);
  useGameRecords(userId);
  const { journey } = useJourney();
  const view = stopId ? journey.byStopId.get(stopId) : undefined;
  // Only a stop the user may play counts towards the river (a stale link never unlocks anything).
  const stopPlayable =
    !!view &&
    (view.status === 'available' || view.status === 'inProgress' || view.status === 'done');

  const onStarted = useCallback(() => {
    if (stopPlayable && stopId) void updateProgress((doc) => markStarted(doc, stopId, Date.now()));
  }, [stopPlayable, stopId, updateProgress]);

  /** The single integration point: a game was played through. */
  const onGameCompleted = useCallback(
    (result: GameResult) => {
      void record(result);
      if (stopPlayable && stopId) {
        void updateProgress((doc) => markDone(doc, stopId, Date.now()));
      }
    },
    [record, stopPlayable, stopId, updateProgress],
  );

  if (!game) {
    return (
      <Screen scroll={false} padded={false} edges={[]} testID="game-screen">
        <View style={[styles.missing, { paddingTop: insets.top + space.xxxl }]}>
          <Text variant="heading" heading align="center" testID="game-unavailable">
            {t('games.shell.notFound')}
          </Text>
          <Button label={t('games.shell.back')} variant="ghost" onPress={back} testID="game-back" />
        </View>
      </Screen>
    );
  }

  return (
    <GameShell
      game={game}
      crocName={crocName}
      resultLabel={resultLabel}
      onStarted={onStarted}
      onGameCompleted={onGameCompleted}
      onLeave={back}
      Game={GAME_SCREENS[game.id]}
    />
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', gap: space.lg, paddingHorizontal: space.xl },
});
