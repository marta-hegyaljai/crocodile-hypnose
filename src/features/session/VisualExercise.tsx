import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { useBreath } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, radius, space, withAlpha } from '@/theme';
import { Button, IconButton, ProgressBar, Reveal, Text } from '@/ui';

import { SessionExit } from './AudioPlayer';
import { BreathingVisual } from './BreathingVisual';
import {
  EndSessionDialog,
  NightDock,
  NightScene,
  useAutoDim,
  type Dive,
  type NightLayout,
} from './NightRiver';
import { useDevFastForward, type Listening } from './useListening';
import { formatClock } from './useTrackPlayer';

const TICK_MS = 250;

/**
 * A plain session clock for sessions without media (and media that could not play): runs while
 * `running`, stops at the end, can jump. The position is seconds.
 */
export function useSessionClock(durationSec: number, running: boolean, startAt = 0) {
  const [position, setPosition] = useState(Math.min(startAt, durationSec));
  const finished = position >= durationSec;
  useEffect(() => {
    if (!running || finished) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      setPosition((p) => Math.min(durationSec, p + (now - last) / 1000));
      last = now;
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, finished, durationSec]);
  const seekTo = useCallback(
    (to: number) => setPosition(Math.max(0, Math.min(durationSec, to))),
    [durationSec],
  );
  return { position, finished, seekTo };
}

export interface VisualExerciseProps {
  dive: Dive;
  layout: NightLayout;
  listening: Listening;
  durationSec: number;
  startAt?: number;
  title: string;
  crocName?: string;
  onFinish: () => void;
  onEnd: () => void;
  onSkip?: () => void;
  disabled: boolean;
  onTick?: (position: number) => void;
}

type Step = 'fixation' | 'breathing' | 'imagery';
const IMAGERY_CARDS = 3;

/** Which part of the exercise a moment belongs to: a third each. */
export function visualStep(position: number, duration: number): { step: Step; card: number } {
  const k = duration > 0 ? position / duration : 0;
  if (k < 1 / 3) return { step: 'fixation', card: 0 };
  if (k < 2 / 3) return { step: 'breathing', card: 0 };
  const into = (k - 2 / 3) * 3;
  return { step: 'imagery', card: Math.min(IMAGERY_CARDS - 1, Math.floor(into * IMAGERY_CARDS)) };
}

/**
 * A visual exercise in Night River: a slow glow to rest the eyes on, then the breathing ring,
 * then a few imagery cards, on a gentle clock. Slow fades only, never flashing (WCAG 2.3.1);
 * reduced motion keeps everything still.
 */
export function VisualExercise({
  dive,
  layout,
  listening,
  durationSec,
  startAt = 0,
  title,
  crocName,
  onFinish,
  onEnd,
  onSkip,
  disabled,
  onTick,
}: VisualExerciseProps) {
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const clock = useSessionClock(durationSec, playing && !disabled && !confirming, startAt);
  const dim = useAutoDim(playing && !disabled && !confirming);
  const positionRef = useRef(clock.position);
  const finishedOnce = useRef(false);

  useEffect(() => {
    positionRef.current = clock.position;
    listening.tick(clock.position);
    onTick?.(clock.position);
  }, [clock.position, listening, onTick]);
  useEffect(() => {
    if (!clock.finished || finishedOnce.current) return;
    finishedOnce.current = true;
    onFinish();
  }, [clock.finished, onFinish]);

  const position = useCallback(() => positionRef.current, []);
  const duration = useCallback(() => durationSec, [durationSec]);
  useDevFastForward(!disabled, position, duration, listening, clock.seekTo);

  const { step, card } = visualStep(clock.position, durationSec);
  const { centreX, ringY, visual, height } = layout;
  const stage = Math.round(Math.min(visual * 1.2, height * 0.3));
  const remaining = Math.max(0, durationSec - clock.position);

  return (
    <NightScene
      layout={layout}
      sink={dive.sink}
      depth={dive.depth}
      crocName={crocName}
      eyes={false}
      onTouch={disabled ? undefined : dim.poke}
      testID={disabled ? 'session-night' : 'session-player'}
    >
      <Animated.View
        style={[styles.fill, { paddingTop: insets.top + space.md }, dive.uiStyle]}
        accessibilityLabel={t('player.a11yVisual')}
        pointerEvents={disabled ? 'none' : 'box-none'}
      >
        <Animated.View style={dim.style} pointerEvents="none">
          <Text variant="label" tone="secondary" align="center" testID="session-title-night">
            {title}
          </Text>
        </Animated.View>
        <View
          style={[
            styles.stage,
            { left: centreX - stage / 2, top: ringY - stage / 2, width: stage },
          ]}
          pointerEvents="none"
          testID={`visual-${step}`}
        >
          {step === 'fixation' ? (
            <Glow size={stage} paused={!playing} />
          ) : step === 'breathing' ? (
            <BreathingVisual size={Math.round(stage * 0.85)} paused={!playing} />
          ) : (
            <Reveal key={card} offset={0} style={styles.card}>
              <Text variant="subheading" align="center">
                {t('player.visual.imagery', { n: card + 1 })}
              </Text>
            </Reveal>
          )}
          {step === 'fixation' ? (
            <Text variant="subheading" tone="secondary" align="center">
              {t('player.visual.fixation')}
            </Text>
          ) : null}
        </View>
        <Animated.View style={[StyleSheet.absoluteFill, dim.style]} pointerEvents="box-none">
          <NightDock>
            <ProgressBar
              progress={durationSec > 0 ? clock.position / durationSec : 0}
              tone="water"
              height={8}
              testID="session-progress"
            />
            <View style={styles.times}>
              <Text variant="caption" tone="secondary" testID="session-elapsed">
                {formatClock(clock.position)}
              </Text>
              <Text variant="caption" tone="secondary" testID="session-remaining">
                {t('player.remaining', { time: formatClock(remaining) })}
              </Text>
            </View>
            <View style={styles.controlRow}>
              <IconButton
                icon={playing ? 'pause' : 'play'}
                variant="accent"
                size={64}
                accessibilityLabel={playing ? t('common.pause') : t('common.play')}
                onPress={() => {
                  dim.poke();
                  setPlaying((p) => !p);
                }}
                disabled={disabled || confirming}
                testID="session-toggle"
              />
            </View>
            {onSkip ? (
              <Button
                label={t('dev.skipSession')}
                variant="ghost"
                size="sm"
                disabled={disabled || confirming}
                onPress={onSkip}
                testID="session-dev-skip"
                style={styles.devSkip}
              />
            ) : null}
          </NightDock>
          <View style={[styles.exit, { top: insets.top + space.sm, left: insets.left + space.md }]}>
            <SessionExit
              onPress={() => {
                dim.poke();
                setConfirming(true);
              }}
              disabled={disabled || confirming}
              testID="session-end"
            />
          </View>
        </Animated.View>
      </Animated.View>
      {confirming ? (
        <EndSessionDialog
          testIDPrefix="session"
          onKeepGoing={() => setConfirming(false)}
          onEnd={() => {
            setConfirming(false);
            onEnd();
          }}
        />
      ) : null}
    </NightScene>
  );
}

/** A soft amber glow that brightens and settles over eight seconds (still with reduced motion). */
function Glow({ size, paused }: { size: number; paused: boolean }) {
  const reduced = useReducedMotion();
  const breath = useBreath(!reduced && !paused, 8000, 0, 0.6);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 + breath.value * 0.35,
    transform: [{ scale: 0.92 + breath.value * 0.08 }],
  }));
  const core = Math.round(size * 0.34);
  return (
    <View style={[styles.glowStage, { width: size, height: size }]} accessibilityRole="image">
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 0.9,
            height: size * 0.9,
            borderRadius: size,
            backgroundColor: withAlpha(palette.amber, 0.18),
          },
          style,
        ]}
      />
      <View
        style={{
          width: core,
          height: core,
          borderRadius: core,
          backgroundColor: palette.amber,
          borderWidth: 6,
          borderColor: withAlpha(palette.amberGlow, 0.8),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: space.xl },
  stage: { position: 'absolute', alignItems: 'center', gap: space.md },
  glowStage: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  card: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: withAlpha(palette.shallows, 0.3),
    backgroundColor: withAlpha(palette.nightRiver, 0.7),
    minWidth: 200,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  controlRow: { flexDirection: 'row', justifyContent: 'center', paddingTop: space.xs },
  devSkip: { alignSelf: 'center' },
  exit: { position: 'absolute' },
});
