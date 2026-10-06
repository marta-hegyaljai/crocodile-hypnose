import { useEvent, useEventListener } from 'expo';
import { VideoView, useVideoPlayer, type VideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { palette, radius, space, withAlpha } from '@/theme';
import { Button, IconButton, ProgressBar, Text } from '@/ui';

import { SessionExit } from './AudioPlayer';
import {
  EndSessionDialog,
  NightDock,
  NightScene,
  useAutoDim,
  type Dive,
  type NightLayout,
} from './NightRiver';
import { useDevFastForward, usePauseOnDeviceChange, type Listening } from './useListening';
import { formatClock } from './useTrackPlayer';
import { useSessionClock } from './VisualExercise';
import { cueAt, parseVtt } from './vtt';

/** No movement this long after asking to play: the lesson goes on without the picture. */
const STALL_MS = 5000;

// Player commands live outside the component: the player object is not the component's to change.
function command(player: VideoPlayer, run: (p: VideoPlayer) => void) {
  try {
    run(player);
  } catch {
    // The player is gone (unmounting); nothing to do.
  }
}

export interface VideoLessonProps {
  dive: Dive;
  layout: NightLayout;
  listening: Listening;
  source: number;
  poster: number;
  captions: string;
  fallbackSec: number;
  startAt?: number;
  title: string;
  crocName?: string;
  onFinish: () => void;
  onEnd: () => void;
  onSkip?: () => void;
  disabled: boolean;
  onTick?: (position: number) => void;
}

/**
 * A video lesson: a portrait player in a Night River frame over the river, with a captions toggle
 * (WebVTT), the same dock and the same completion rule as the audio player. If the video cannot
 * play, the lesson goes on with its poster and captions on a plain clock.
 */
export function VideoLesson({
  dive,
  layout,
  listening,
  source,
  poster,
  captions,
  fallbackSec,
  startAt = 0,
  title,
  crocName,
  onFinish,
  onEnd,
  onSkip,
  disabled,
  onTick,
}: VideoLessonProps) {
  const insets = useSafeAreaInsets();
  const [wanted, setWanted] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [videoTime, setVideoTime] = useState(startAt);
  const [ended, setEnded] = useState(false);
  const cues = useMemo(() => parseVtt(captions), [captions]);
  const player = useVideoPlayer(source, (p) => {
    p.timeUpdateEventInterval = 0.25;
    p.loop = false;
    if (startAt > 0) p.currentTime = startAt;
  });
  const running = wanted && !disabled && !confirming;
  const clock = useSessionClock(fallbackSec, fallback && running, videoTime);
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const dim = useAutoDim(running);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => setVideoTime(currentTime));
  useEventListener(player, 'playToEnd', () => setEnded(true));

  // Play while wanted and usable; pause otherwise.
  useEffect(() => {
    if (fallback) return;
    command(player, (p) => (running ? p.play() : p.pause()));
  }, [player, running, fallback]);

  // Stall or error: carry on without the picture.
  const lastMove = useRef({ at: 0, time: startAt });
  useEffect(() => {
    if (fallback || !running) return;
    lastMove.current = { at: Date.now(), time: lastMove.current.time };
    const timer = setInterval(() => {
      const now = Date.now();
      if (player.currentTime !== lastMove.current.time) {
        lastMove.current = { at: now, time: player.currentTime };
      } else if (now - lastMove.current.at > STALL_MS) {
        command(player, (p) => p.pause());
        setFallback(true);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [player, running, fallback]);
  useEffect(() => {
    if (status !== 'error' || fallback) return;
    const timer = setTimeout(() => setFallback(true), 0);
    return () => clearTimeout(timer);
  }, [status, fallback]);

  const duration =
    !fallback && Number.isFinite(player.duration) && player.duration > 0
      ? player.duration
      : fallbackSec;
  const position = fallback ? clock.position : videoTime;
  const finished = fallback ? clock.finished : ended;

  const positionRef = useRef(position);
  const durationRef = useRef(duration);
  useEffect(() => {
    positionRef.current = position;
    durationRef.current = duration;
    listening.tick(position);
    onTick?.(position);
  }, [position, duration, listening, onTick]);
  const finishedOnce = useRef(false);
  useEffect(() => {
    if (!finished || finishedOnce.current) return;
    finishedOnce.current = true;
    onFinish();
  }, [finished, onFinish]);

  const seekTo = useCallback(
    (to: number) => {
      if (fallback) clock.seekTo(to);
      else command(player, (p) => (p.currentTime = to));
    },
    [fallback, clock, player],
  );
  const getPosition = useCallback(() => positionRef.current, []);
  const getDuration = useCallback(() => durationRef.current, []);
  useDevFastForward(!disabled, getPosition, getDuration, listening, seekTo);
  const pause = useCallback(() => setWanted(false), []);
  usePauseOnDeviceChange(running, pause);

  // A portrait frame between the title and the dock.
  const { width, height, landscape } = layout;
  const frameH = Math.round(Math.min(height * (landscape ? 0.78 : 0.5), 520));
  const frameW = Math.round(Math.min(frameH * (9 / 16), width - space.xl * 2));
  const cue = showCaptions ? cueAt(cues, position) : null;
  const remaining = Math.max(0, duration - position);

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
        accessibilityLabel={t('player.a11yVideo')}
        pointerEvents={disabled ? 'none' : 'box-none'}
      >
        <Animated.View style={dim.style} pointerEvents="none">
          <Text variant="label" tone="secondary" align="center" testID="session-title-night">
            {title}
          </Text>
        </Animated.View>
        <View
          style={[
            styles.frame,
            landscape
              ? { left: insets.left + space.xxl, top: (height - frameH) / 2 }
              : { alignSelf: 'center', top: insets.top + space.xxxl },
            { width: frameW, height: frameH },
          ]}
          pointerEvents="none"
          testID="session-video"
        >
          {fallback ? (
            <Image source={poster} style={styles.media} resizeMode="cover" />
          ) : (
            <>
              <VideoView
                player={player}
                style={styles.media}
                contentFit="cover"
                nativeControls={false}
              />
              {videoTime === 0 ? (
                <Image source={poster} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : null}
            </>
          )}
          {cue ? (
            <View style={styles.caption} testID="session-caption">
              <Text variant="body" align="center">
                {cue.text}
              </Text>
            </View>
          ) : null}
        </View>
        <Animated.View style={[StyleSheet.absoluteFill, dim.style]} pointerEvents="box-none">
          <NightDock>
            {fallback ? (
              <Text variant="caption" tone="muted" align="center" testID="session-silent">
                {t('player.videoUnavailable')}
              </Text>
            ) : null}
            <ProgressBar
              progress={duration > 0 ? position / duration : 0}
              tone="water"
              height={8}
              testID="session-progress"
            />
            <View style={styles.times}>
              <Text variant="caption" tone="secondary" testID="session-elapsed">
                {formatClock(position)}
              </Text>
              <Text variant="caption" tone="secondary" testID="session-remaining">
                {t('player.remaining', { time: formatClock(remaining) })}
              </Text>
            </View>
            <View style={styles.controlRow}>
              <View style={styles.spacer} />
              <IconButton
                icon={wanted ? 'pause' : 'play'}
                variant="accent"
                size={64}
                accessibilityLabel={wanted ? t('common.pause') : t('common.play')}
                onPress={() => {
                  dim.poke();
                  setWanted((w) => !w);
                }}
                disabled={disabled || confirming}
                testID="session-toggle"
              />
              <IconButton
                icon="captions"
                variant={showCaptions ? 'filled' : 'ghost'}
                accessibilityLabel={showCaptions ? t('player.captionsOn') : t('player.captionsOff')}
                accessibilityState={{ selected: showCaptions }}
                onPress={() => {
                  dim.poke();
                  setShowCaptions((c) => !c);
                }}
                disabled={disabled || confirming}
                testID="session-captions"
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

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: space.xl },
  frame: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: withAlpha(palette.shallows, 0.35),
    backgroundColor: palette.nightRiver,
  },
  media: { width: '100%', height: '100%' },
  caption: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    bottom: space.md,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: withAlpha(palette.nightRiver, 0.85),
  },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.xl,
    paddingTop: space.xs,
  },
  spacer: { width: 48, height: 48 },
  devSkip: { alignSelf: 'center' },
  exit: { position: 'absolute' },
});
