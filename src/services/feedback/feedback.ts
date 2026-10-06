/**
 * Tactile and audible feedback for the gamified moments (a tap on the egg, the hatch, a reward).
 * Platform adapters are injected; everything is a no-op when the user turned it off or the
 * atmosphere is Night River (trances are silent and still).
 */

export type HapticKind = 'tap' | 'select' | 'success';
export type UiSound = 'tap' | 'hatch';

export interface HapticsAdapter {
  play(kind: HapticKind): Promise<void>;
}

export interface SoundAdapter {
  play(sound: UiSound): Promise<void>;
}

export interface FeedbackSettings {
  haptics: boolean;
  sound: boolean;
  /** Night River: nothing plays, whatever the settings say. */
  muted: boolean;
}

export interface Feedback {
  haptic(kind: HapticKind): void;
  sound(sound: UiSound): void;
  configure(settings: Partial<FeedbackSettings>): void;
  readonly settings: FeedbackSettings;
}

export const silentHaptics: HapticsAdapter = { play: async () => undefined };
export const silentSounds: SoundAdapter = { play: async () => undefined };

export function createFeedback(
  adapters: { haptics?: HapticsAdapter; sounds?: SoundAdapter } = {},
  initial: Partial<FeedbackSettings> = {},
): Feedback {
  const haptics = adapters.haptics ?? silentHaptics;
  const sounds = adapters.sounds ?? silentSounds;
  const settings: FeedbackSettings = { haptics: true, sound: true, muted: false, ...initial };
  const swallow = () => undefined;
  return {
    settings,
    configure(next) {
      Object.assign(settings, next);
    },
    haptic(kind) {
      if (!settings.haptics || settings.muted) return;
      // Feedback never breaks a flow: failures (no vibrator, web) are ignored.
      haptics.play(kind).catch(swallow);
    },
    sound(sound) {
      if (!settings.sound || settings.muted) return;
      sounds.play(sound).catch(swallow);
    },
  };
}
