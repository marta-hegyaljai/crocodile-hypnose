import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { durationLabel } from '@/features/map/stopLabels';
import { useFeedback } from '@/services/feedback';
import { AtmosphereProvider, palette, radius, space, useTheme, withAlpha } from '@/theme';
import { Button, Chip, IconButton, Reveal, Screen, Text } from '@/ui';

import type { GameDef, GameResult } from './catalog';

export type GamePhase = 'intro' | 'playing' | 'paused' | 'ended';

/** What every game gets from the shell. */
export interface GameProps {
  /** The clock runs and input counts. */
  running: boolean;
  /** The game is over (the end card is up): rest in a calm pose. */
  ended: boolean;
  onFinish: (result: GameResult) => void;
  crocName?: string;
}

export interface GameShellProps {
  game: GameDef;
  crocName?: string;
  /** The game itself (its own scene and input), drawn under the shell's cards. */
  Game: React.ComponentType<GameProps>;
  /** One line for the end card, e.g. "7 breaths". */
  resultLabel: (result: GameResult) => string;
  /** Called the moment a game is played through (never on a quit). */
  onGameCompleted: (result: GameResult) => void;
  /** The first time the user starts the game on this screen. */
  onStarted?: () => void;
  /** Leave the screen (back to where the game was opened). */
  onLeave: () => void;
  testID?: string;
}

/**
 * The frame around every mini-game: an intro card that says how to play, a pause that also
 * triggers when the app goes to the background, a way out with no penalty, and a calm end card
 * with the result and the invitation to try again with eyes closed. The game itself draws the
 * full-bleed scene underneath.
 */
export function GameShell(props: GameShellProps) {
  return (
    <AtmosphereProvider atmosphere={props.game.atmosphere}>
      <ShellBody {...props} />
    </AtmosphereProvider>
  );
}

function ShellBody({
  game,
  crocName,
  Game,
  resultLabel,
  onGameCompleted,
  onStarted,
  onLeave,
  testID = 'game-screen',
}: GameShellProps) {
  const { colors, shadow, atmosphere } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const feedback = useFeedback();
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [result, setResult] = useState<GameResult | null>(null);
  // A new round remounts the game so it starts clean.
  const [round, setRound] = useState(0);
  const started = useRef(false);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const start = useCallback(() => {
    if (phaseRef.current !== 'intro' && phaseRef.current !== 'ended') return;
    if (!started.current) {
      started.current = true;
      onStarted?.();
    }
    feedback.haptic('select');
    setResult(null);
    setRound((r) => r + 1);
    setPhase('playing');
  }, [feedback, onStarted]);

  const finish = useCallback(
    (r: GameResult) => {
      if (phaseRef.current !== 'playing' && phaseRef.current !== 'paused') return;
      setResult(r);
      setPhase('ended');
      feedback.haptic('success');
      onGameCompleted(r);
    },
    [feedback, onGameCompleted],
  );

  // Leaving the app pauses the game; it never runs on unseen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && phaseRef.current === 'playing') setPhase('paused');
    });
    return () => sub.remove();
  }, []);

  const night = atmosphere === 'night';
  const short = height < 700;
  const title = t(game.titleKey);
  const cardBg = night ? withAlpha(palette.nightRiver, 0.86) : colors.surface;

  return (
    <Screen scroll={false} padded={false} edges={[]} testID={testID}>
      {/* Keyed by round: "Play again" remounts the game so it starts clean. */}
      <View
        key={round}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={t('games.shell.a11yStage', { title })}
      >
        <Game
          running={phase === 'playing'}
          ended={phase === 'ended'}
          onFinish={finish}
          crocName={crocName}
        />
      </View>

      {/* Top bar: the way out on the left, pause on the right while playing. */}
      <View
        style={[
          styles.bar,
          {
            top: insets.top + space.sm,
            left: insets.left + space.md,
            right: insets.right + space.md,
          },
        ]}
        pointerEvents="box-none"
      >
        <IconButton
          icon="back"
          variant="filled"
          accessibilityLabel={t('games.shell.back')}
          onPress={() => (phase === 'playing' ? setPhase('paused') : onLeave())}
          testID="game-back"
        />
        <Text variant="label" tone="secondary" numberOfLines={1} style={styles.barTitle}>
          {title}
        </Text>
        {phase === 'playing' ? (
          <IconButton
            icon="pause"
            variant="filled"
            accessibilityLabel={t('games.shell.pause')}
            onPress={() => setPhase('paused')}
            testID="game-pause"
          />
        ) : (
          <View style={styles.barSpacer} />
        )}
      </View>

      {phase === 'intro' ? (
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Reveal offset={18}>
            <View
              style={[
                styles.sheet,
                shadow.raised,
                {
                  backgroundColor: cardBg,
                  paddingBottom: insets.bottom + space.xl,
                  borderColor: night ? withAlpha(palette.shallows, 0.22) : 'transparent',
                },
              ]}
              testID="game-intro"
            >
              <Text variant={short ? 'heading' : 'title'} heading testID="game-intro-title">
                {title}
              </Text>
              <Text variant="body" tone="secondary" testID="game-intro-howto">
                {t(game.howToKey)}
              </Text>
              <View style={styles.chips}>
                <Chip label={t(game.skillKey)} tone="goal" icon="sparkle" />
                <Chip label={durationLabel(game.durationSec)} tone="neutral" />
              </View>
              <Button
                label={t('games.shell.start')}
                icon="play"
                size="lg"
                fullWidth
                onPress={start}
                testID="game-start"
              />
            </View>
          </Reveal>
        </View>
      ) : null}

      {phase === 'paused' ? (
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]} testID="game-paused">
          <Reveal style={styles.dialogWrap}>
            <View
              style={[
                styles.dialog,
                shadow.raised,
                {
                  backgroundColor: night ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text variant="heading" heading>
                {t('games.shell.paused')}
              </Text>
              <Text variant="body" tone="secondary">
                {t('games.shell.quitNote')}
              </Text>
              <Button
                label={t('games.shell.resume')}
                icon="play"
                size="lg"
                fullWidth
                onPress={() => setPhase('playing')}
                testID="game-resume"
              />
              <Button
                label={t('games.shell.quit')}
                variant="ghost"
                fullWidth
                onPress={onLeave}
                testID="game-quit"
              />
            </View>
          </Reveal>
        </View>
      ) : null}

      {phase === 'ended' && result ? (
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Reveal offset={18}>
            <View
              style={[
                styles.sheet,
                shadow.raised,
                {
                  backgroundColor: cardBg,
                  paddingBottom: insets.bottom + space.xl,
                  borderColor: night ? withAlpha(palette.shallows, 0.22) : 'transparent',
                },
              ]}
              testID="game-end"
            >
              <Text variant="label" tone="secondary">
                {t('games.shell.endTitle')}
              </Text>
              <Text variant="title" heading color={colors.textAccent} testID="game-result">
                {resultLabel(result)}
              </Text>
              <Text variant="body" tone="secondary" testID="game-eyes-closed">
                {t('games.shell.eyesClosed')}
              </Text>
              <Button
                label={t('games.shell.done')}
                size="lg"
                fullWidth
                onPress={onLeave}
                testID="game-done"
              />
              <Button
                label={t('games.shell.playAgain')}
                variant="ghost"
                fullWidth
                onPress={start}
                testID="game-play-again"
              />
            </View>
          </Reveal>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  barTitle: { flex: 1, textAlign: 'center' },
  barSpacer: { width: 44, height: 44 },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: space.xl,
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  dialogWrap: { width: '100%', maxWidth: 400 },
  dialog: { borderRadius: radius.lg, borderWidth: 1, padding: space.xl, gap: space.md },
});
