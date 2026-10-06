import React, { useCallback, useId, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { Lagoon } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, space } from '@/theme';
import { Text } from '@/ui';

import type { GameProps } from '../GameShell';
import {
  FIREFLY_ROUNDS,
  clamp01,
  fireflyPhase,
  fireflyPoint,
  fireflyTotalMs,
  type FireflyPhase,
} from '../scoring';
import { useGameClock } from '../useGameClock';

const BODY = 16;
const HALO = 84;
const TRAIL = 6;
const TRAIL_LAG_MS = 110;

/**
 * Firefly (Night River): one bright firefly drifts in a slow figure of eight over the river while
 * the croc watches; three rounds, each slower than the last, then the firefly settles and the
 * screen invites you to close your eyes. Nothing to tap, nothing to get wrong.
 */
export function FireflyGame({ running, ended, onFinish, crocName }: GameProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<FireflyPhase>({ kind: 'round', round: 0, progress: 0 });
  const finished = useRef(false);

  const onTick = useCallback(
    (time: number) => {
      if (finished.current) return;
      const p = fireflyPhase(time);
      setPhase((prev) =>
        prev.kind === p.kind &&
        (p.kind !== 'round' || (prev as { round: number }).round === p.round)
          ? prev
          : p,
      );
      if (p.kind === 'done') {
        finished.current = true;
        onFinish({ gameId: 'firefly', rounds: FIREFLY_ROUNDS, total: FIREFLY_ROUNDS });
      }
    },
    [onFinish],
  );
  const { timeMs } = useGameClock(running, onTick);

  // The firefly flies over the sky and the water, in the band between the bars.
  const stageTop = insets.top + 72;
  const stageBottom = height - insets.bottom - 150;
  const stage = { left: 0, top: stageTop, width, height: Math.max(120, stageBottom - stageTop) };
  const eyesClosed = phase.kind === 'eyesClosed' || ended;
  const total = fireflyTotalMs();

  return (
    <View style={styles.root} testID="firefly-game">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Lagoon
          width={width}
          height={height}
          stage="hatchling"
          expression={eyesClosed ? 'eyesClosed' : running ? 'calm' : 'happy'}
          waterTop={height < 700 ? 0.6 : 0.64}
          crocX={0.5}
          crocWidth={Math.min(Math.round(width * 0.62), 320)}
          crocName={crocName}
          leafSize={Math.min(Math.round(width * 0.2), Math.round(height * 0.14))}
          farReeds={false}
        />
      </View>
      {running || ended ? (
        <View style={[styles.stage, stage]} pointerEvents="none">
          {!reducedMotion &&
            Array.from({ length: TRAIL }, (_, i) => (
              <Glow
                key={i}
                timeMs={timeMs}
                lagMs={(i + 1) * TRAIL_LAG_MS}
                size={BODY * (1 - (i + 1) / (TRAIL + 1)) + 4}
                halo={0}
                dim={0.55 * (1 - (i + 1) / (TRAIL + 1))}
                stage={stage}
                total={total}
                pulse={false}
              />
            ))}
          <Glow
            timeMs={timeMs}
            lagMs={0}
            size={BODY}
            halo={HALO}
            dim={1}
            stage={stage}
            total={total}
            pulse={!reducedMotion}
            testID="firefly-hero"
          />
        </View>
      ) : null}
      {running ? (
        <View
          style={[styles.cue, { top: insets.top + space.xxxl + space.lg }]}
          pointerEvents="none"
        >
          {phase.kind === 'round' ? (
            <>
              <Text variant="label" tone="secondary" align="center" testID="firefly-round">
                {t('games.firefly.round', { n: phase.round + 1, total: FIREFLY_ROUNDS })}
              </Text>
              <Text variant="subheading" tone="secondary" align="center">
                {t('games.firefly.follow')}
              </Text>
            </>
          ) : phase.kind === 'eyesClosed' ? (
            <Text variant="heading" heading align="center" testID="firefly-close-eyes">
              {t('games.firefly.closeEyes')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** One glowing point following the path at `lagMs` behind the clock, fading out at the end. */
function Glow({
  timeMs,
  lagMs,
  size,
  halo,
  dim,
  stage,
  total,
  pulse,
  testID,
}: {
  timeMs: SharedValue<number>;
  lagMs: number;
  size: number;
  halo: number;
  dim: number;
  stage: { width: number; height: number };
  total: number;
  pulse: boolean;
  testID?: string;
}) {
  const id = `glow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const box = Math.max(size, halo) + 8;
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, timeMs.value - lagMs);
    const p = fireflyPoint(t);
    // The rounds end 8 s before `total`: the firefly settles and fades during the eyes-closed moment.
    const fade = 1 - clamp01((t - (total - 8000)) / 2500);
    const breathe = pulse ? 0.85 + 0.15 * Math.sin(t / 420) : 1;
    return {
      opacity: dim * fade * breathe,
      transform: [
        { translateX: p.x * stage.width - box / 2 },
        { translateY: p.y * stage.height - box / 2 },
        { scale: 0.9 + 0.1 * breathe },
      ],
    };
  });
  return (
    <Animated.View style={[styles.glow, { width: box, height: box }, style]} testID={testID}>
      <Svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={palette.amberGlow} stopOpacity={0.9} />
            <Stop offset="0.3" stopColor={palette.amber} stopOpacity={0.35} />
            <Stop offset="1" stopColor={palette.amber} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {halo > 0 ? <Circle cx={box / 2} cy={box / 2} r={halo / 2} fill={`url(#${id})`} /> : null}
        <Circle cx={box / 2} cy={box / 2} r={size / 2} fill={palette.amberGlow} />
        <Circle
          cx={box / 2 - size * 0.12}
          cy={box / 2 - size * 0.14}
          r={size * 0.18}
          fill={palette.white}
          opacity={0.9}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { position: 'absolute', overflow: 'visible' },
  glow: { position: 'absolute', left: 0, top: 0 },
  cue: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    alignItems: 'center',
    gap: space.xs,
  },
});
