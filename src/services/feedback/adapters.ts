import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { HapticKind, HapticsAdapter, SoundAdapter, UiSound } from './feedback';

/** expo-haptics on iOS and Android; browsers have no haptics worth the name. */
export const deviceHaptics: HapticsAdapter = {
  async play(kind: HapticKind) {
    if (Platform.OS === 'web') return;
    switch (kind) {
      case 'tap':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'select':
        return Haptics.selectionAsync();
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },
};

const SOURCES: Record<UiSound, number> = {
  tap: require('../../../assets/audio/tap.mp3'),
  hatch: require('../../../assets/audio/hatch.mp3'),
};

/** Short UI sounds through expo-audio; one player per sound, created on first use. */
export function createDeviceSounds(): SoundAdapter {
  const players = new Map<UiSound, AudioPlayer>();
  return {
    async play(sound) {
      let player = players.get(sound);
      if (!player) {
        player = createAudioPlayer(SOURCES[sound]);
        players.set(sound, player);
      }
      // A sound may be asked for again before the last one ended: start over.
      await player.seekTo(0);
      player.play();
    },
  };
}
