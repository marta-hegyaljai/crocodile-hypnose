import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t, type CopyKey } from '@/copy';
import { space } from '@/theme';
import { Button, IconButton, ProgressBar, Text } from '@/ui';

import { BreathingVisual } from './BreathingVisual';
import {
  EndSessionDialog,
  NightDock,
  NightScene,
  useAutoDim,
  type Dive,
  type NightLayout,
} from './NightRiver';
import {
  SOUNDSCAPES,
  useDevFastForward,
  usePauseOnDeviceChange,
  useSoundscape,
  type Listening,
  type Soundscape,
} from './useListening';
import { formatClock, useTrackStatus, type Track } from './useTrackPlayer';

export interface AudioPlayerProps {
  track: Track;
  dive: Dive;
  layout: NightLayout;
  listening: Listening;
  title: string;
  crocName?: string;
  /** Test ids start with this (`first-session` in onboarding, `session` elsewhere). */
  testIDPrefix: string;
  /** The track reached its end. */
  onFinish: () => void;
  /** The user ended the session early (after confirming). */
  onEnd: () => void;
  /** Dev builds: jump to the end. */
  onSkip?: () => void;
  /** The scene is on screen but the player cannot be used yet (diving, rising). */
  disabled: boolean;
  /** Offer the background sound choice. */
  soundscapes?: boolean;
  /** Every status tick, for saving the place to resume. */
  onTick?: (position: number) => void;
}

/**
 * The audio trance player in Night River: the croc's glowing eyes under the water with the
 * breathing ripples around them, and a dock with progress, elapsed and remaining time, play/pause,
 * back 15 s and the background sound. Controls fade away after a few seconds without a touch.
 * No counters, points or pop-ups while it plays.
 */
export function AudioPlayer({
  track,
  dive,
  layout,
  listening,
  title,
  crocName,
  testIDPrefix,
  onFinish,
  onEnd,
  onSkip,
  disabled,
  soundscapes = false,
  onTick,
}: AudioPlayerProps) {
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);
  const [sound, setSound] = useState<Soundscape>('none');
  const [choosing, setChoosing] = useState(false);
  // The breathing guide restarts with each resume, so the cue and the ring agree.
  const [cycle, setCycle] = useState(0);
  const playing = track.wanted;
  const dim = useAutoDim(playing && !disabled && !confirming && !choosing);
  useSoundscape(sound, playing && !disabled);
  const { pause, seekTo, positionRef, durationRef } = track;
  usePauseOnDeviceChange(playing, pause);
  const position = useCallback(() => positionRef.current, [positionRef]);
  const duration = useCallback(() => durationRef.current, [durationRef]);
  useDevFastForward(!disabled, position, duration, listening, seekTo);

  const toggle = () => {
    dim.poke();
    if (playing) {
      track.pause();
    } else {
      setCycle((c) => c + 1);
      track.play();
    }
  };
  const back15 = () => {
    dim.poke();
    seekTo(Math.max(0, positionRef.current - 15));
  };

  const { visual, centreX, ringY } = layout;
  const id = (name: string) => `${testIDPrefix}-${name}`;

  return (
    <NightScene
      layout={layout}
      sink={dive.sink}
      depth={dive.depth}
      crocName={crocName}
      onTouch={disabled ? undefined : dim.poke}
      // The scene is on screen during the dive and the rise; the player, once it can be used.
      testID={disabled ? id('night') : id('player')}
    >
      <Animated.View
        style={[styles.player, { paddingTop: insets.top + space.md }, dive.uiStyle]}
        accessibilityLabel={t('player.a11y')}
        pointerEvents={disabled ? 'none' : 'box-none'}
      >
        <Animated.View style={dim.style} pointerEvents="none">
          <Text variant="label" tone="secondary" align="center" testID={id('title')}>
            {title}
          </Text>
        </Animated.View>
        <View
          style={[styles.visual, { left: centreX - visual / 2, top: ringY - visual / 2 }]}
          pointerEvents="none"
        >
          <BreathingVisual key={cycle} size={visual} paused={!playing} testID="breathing" />
        </View>
        <Animated.View style={[StyleSheet.absoluteFill, dim.style]} pointerEvents="box-none">
          <NightDock>
            <PlaybackStatus
              track={track}
              listening={listening}
              onFinish={onFinish}
              onTick={onTick}
              testIDPrefix={testIDPrefix}
            />
            {choosing ? (
              <View style={styles.sounds} accessibilityRole="radiogroup" testID={id('sounds')}>
                {SOUNDSCAPES.map((s) => (
                  <Button
                    key={s}
                    label={t(`player.soundscapes.${s}` as CopyKey)}
                    variant={sound === s ? 'secondary' : 'ghost'}
                    size="sm"
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sound === s }}
                    onPress={() => {
                      setSound(s);
                      setChoosing(false);
                      dim.poke();
                    }}
                    testID={id(`sound-${s}`)}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.controlRow}>
              <IconButton
                icon="rewind"
                variant="ghost"
                accessibilityLabel={t('player.back15')}
                onPress={back15}
                disabled={disabled || confirming}
                testID={id('back15')}
              />
              <IconButton
                icon={playing ? 'pause' : 'play'}
                variant="accent"
                size={64}
                accessibilityLabel={playing ? t('common.pause') : t('common.play')}
                onPress={toggle}
                disabled={disabled || confirming}
                testID={id('toggle')}
              />
              {soundscapes ? (
                <IconButton
                  icon="waves"
                  variant="ghost"
                  accessibilityLabel={t('player.sound')}
                  onPress={() => {
                    dim.poke();
                    setChoosing((c) => !c);
                  }}
                  disabled={disabled || confirming}
                  testID={id('sound')}
                />
              ) : (
                <View style={styles.spacer} />
              )}
            </View>
            {onSkip ? (
              <Button
                label={t('dev.skipSession')}
                variant="ghost"
                size="sm"
                disabled={disabled || confirming}
                onPress={onSkip}
                testID={id('dev-skip')}
                style={styles.devSkip}
              />
            ) : null}
          </NightDock>
          {/* A calm way out, top-left; it asks once before ending the session early. */}
          <View style={[styles.exit, { top: insets.top + space.sm, left: insets.left + space.md }]}>
            <SessionExit
              onPress={() => {
                dim.poke();
                setConfirming(true);
              }}
              disabled={disabled || confirming}
              testID={id('end')}
            />
          </View>
        </Animated.View>
      </Animated.View>
      {confirming ? (
        <EndSessionDialog
          testIDPrefix={testIDPrefix}
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

/** The close button of every Night River player. */
export function SessionExit({
  onPress,
  disabled,
  testID,
}: {
  onPress: () => void;
  disabled: boolean;
  testID: string;
}) {
  return (
    <IconButton
      icon="close"
      variant="filled"
      accessibilityLabel={t('player.end')}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    />
  );
}

/**
 * Progress, elapsed and remaining time: the only part that follows the track several times a
 * second. It also feeds what was listened to.
 */
function PlaybackStatus({
  track,
  listening,
  onFinish,
  onTick,
  testIDPrefix,
}: {
  track: Track;
  listening: Listening;
  onFinish: () => void;
  onTick?: (position: number) => void;
  testIDPrefix: string;
}) {
  const status = useTrackStatus(track, { onFinish });
  const remaining = Math.max(0, status.duration - status.position);
  useEffect(() => {
    listening.tick(status.position);
    onTick?.(status.position);
  }, [status.position, listening, onTick]);
  return (
    <>
      {track.silent ? (
        <Text variant="caption" tone="muted" align="center" testID={`${testIDPrefix}-silent`}>
          {t('player.audioUnavailable')}
        </Text>
      ) : null}
      <ProgressBar
        progress={status.duration > 0 ? status.position / status.duration : 0}
        tone="water"
        height={8}
        testID={`${testIDPrefix}-progress`}
      />
      <View style={styles.times}>
        <Text variant="caption" tone="secondary" testID={`${testIDPrefix}-elapsed`}>
          {formatClock(status.position)}
        </Text>
        <Text variant="caption" tone="secondary" testID={`${testIDPrefix}-remaining`}>
          {t('player.remaining', { time: formatClock(remaining) })}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  player: { flex: 1, paddingHorizontal: space.xl },
  visual: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.xl,
    paddingTop: space.xs,
  },
  spacer: { width: 48, height: 48 },
  sounds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  devSkip: { alignSelf: 'center' },
  exit: { position: 'absolute' },
});
