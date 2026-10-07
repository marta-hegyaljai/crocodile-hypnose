import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { gameById, type GameResult } from './catalog';
import { GameShell, type GameProps } from './GameShell';
import { GamesClearing } from './GamesClearing';
import { emptyRecords, recordPlay } from './records';
import { resultLabel } from './resultLabel';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** A stand-in game: says whether it runs and finishes on a tap. */
function StubGame({ running, ended, onFinish }: GameProps) {
  return (
    <>
      <Text testID="stub-state">{ended ? 'ended' : running ? 'running' : 'idle'}</Text>
      <Pressable
        testID="stub-finish"
        onPress={() => onFinish({ gameId: 'breathing', breaths: 7 })}
      />
      <Pressable
        testID="stub-finish-idle"
        onPress={() => onFinish({ gameId: 'breathing', breaths: 0 })}
      />
    </>
  );
}

async function renderShell() {
  const onGameCompleted = jest.fn<void, [GameResult]>();
  const onLeave = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <GameShell
        game={gameById('breathing')!}
        Game={StubGame}
        resultLabel={resultLabel}
        onGameCompleted={onGameCompleted}
        onLeave={onLeave}
      />
    </SafeAreaProvider>,
  );
  return { onGameCompleted, onLeave };
}

describe('GameShell', () => {
  it('does not count a round with no play in it, and offers another go', async () => {
    const { onGameCompleted, onLeave } = await renderShell();
    await fireEvent.press(screen.getByTestId('game-start'));
    await fireEvent.press(screen.getByTestId('stub-finish-idle'));
    expect(onGameCompleted).not.toHaveBeenCalled();
    expect(screen.getByTestId('game-not-counted')).toBeTruthy();
    expect(screen.queryByTestId('game-result')).toBeNull();
    expect(screen.getByTestId('stub-state')).toHaveTextContent('ended');

    await fireEvent.press(screen.getByTestId('game-play-again'));
    expect(screen.queryByTestId('game-not-counted')).toBeNull();
    await fireEvent.press(screen.getByTestId('stub-finish'));
    expect(onGameCompleted).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('game-result')).toHaveTextContent('7 breaths');
    await fireEvent.press(screen.getByTestId('game-done'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('explains the game, starts it once, pauses and resumes, and leaves without penalty', async () => {
    const { onLeave, onGameCompleted } = await renderShell();
    expect(screen.getByTestId('game-intro-title')).toHaveTextContent('Breathing');
    expect(screen.getByTestId('game-intro-howto')).toBeTruthy();
    expect(screen.getByTestId('stub-state')).toHaveTextContent('idle');

    // Back from the intro leaves straight away.
    await fireEvent.press(screen.getByTestId('game-back'));
    expect(onLeave).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('game-start'));
    expect(screen.getByTestId('stub-state')).toHaveTextContent('running');
    expect(screen.queryByTestId('game-intro')).toBeNull();

    await fireEvent.press(screen.getByTestId('game-pause'));
    expect(screen.getByTestId('game-paused')).toBeTruthy();
    // The pause card is modal: the game behind it is out of the accessibility tree.
    expect(screen.queryByTestId('stub-state')).toBeNull();
    expect(screen.getByTestId('stub-state', { includeHiddenElements: true })).toHaveTextContent(
      'idle',
    );
    await fireEvent.press(screen.getByTestId('game-resume'));
    expect(screen.getByTestId('stub-state')).toHaveTextContent('running');

    // Back while playing pauses instead of leaving; leaving from there completes nothing.
    await fireEvent.press(screen.getByTestId('game-back'));
    expect(screen.getByTestId('game-paused')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('game-quit'));
    expect(onLeave).toHaveBeenCalledTimes(2);
    expect(onGameCompleted).not.toHaveBeenCalled();
  });

  it('shows the result once at the end and plays again from a clean start', async () => {
    const { onGameCompleted, onLeave } = await renderShell();
    await fireEvent.press(screen.getByTestId('game-start'));
    await fireEvent.press(screen.getByTestId('stub-finish'));
    await fireEvent.press(screen.getByTestId('stub-finish')); // a double tap at the end
    expect(onGameCompleted).toHaveBeenCalledTimes(1);
    expect(onGameCompleted).toHaveBeenCalledWith({ gameId: 'breathing', breaths: 7 });
    expect(screen.getByTestId('game-result')).toHaveTextContent('7 breaths');
    expect(screen.getByTestId('game-eyes-closed')).toBeTruthy();
    expect(screen.getByTestId('stub-state')).toHaveTextContent('ended');

    await fireEvent.press(screen.getByTestId('game-play-again'));
    expect(screen.queryByTestId('game-end')).toBeNull();
    expect(screen.getByTestId('stub-state')).toHaveTextContent('running');

    await fireEvent.press(screen.getByTestId('stub-finish'));
    await fireEvent.press(screen.getByTestId('game-done'));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onGameCompleted).toHaveBeenCalledTimes(2);
  });
});

describe('GamesClearing', () => {
  it('lists the three games with their plays and best results, and opens one', async () => {
    const onOpen = jest.fn();
    const records = recordPlay(recordPlay(emptyRecords(), { gameId: 'stillness', score: 64 }), {
      gameId: 'stillness',
      score: 81,
    });
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <GamesClearing records={records} crocName="Zé" onOpen={onOpen} />
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('game-card-stillness-plays')).toHaveTextContent('Played 2 times');
    expect(screen.getByTestId('game-card-stillness-best')).toHaveTextContent('Best: 81/100 still');
    expect(screen.getByTestId('game-card-firefly-plays')).toHaveTextContent('Not played yet');
    expect(screen.queryByTestId('game-card-firefly-best')).toBeNull();
    expect(screen.getByTestId('game-card-breathing-plays')).toHaveTextContent('Not played yet');
    await fireEvent.press(screen.getByTestId('game-card-firefly'));
    expect(onOpen).toHaveBeenCalledWith('firefly');
  });
});
