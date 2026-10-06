import { createFeedback, type HapticKind, type UiSound } from './feedback';

describe('feedback', () => {
  function setup() {
    const haptics: HapticKind[] = [];
    const sounds: UiSound[] = [];
    const feedback = createFeedback({
      haptics: {
        play: async (kind) => {
          haptics.push(kind);
        },
      },
      sounds: {
        play: async (sound) => {
          sounds.push(sound);
        },
      },
    });
    return { feedback, haptics, sounds };
  }

  it('plays haptics and sounds when enabled', () => {
    const { feedback, haptics, sounds } = setup();
    feedback.haptic('tap');
    feedback.sound('hatch');
    expect(haptics).toEqual(['tap']);
    expect(sounds).toEqual(['hatch']);
  });

  it('respects the settings and the Night River mute', () => {
    const { feedback, haptics, sounds } = setup();
    feedback.configure({ haptics: false });
    feedback.haptic('success');
    feedback.sound('tap');
    expect(haptics).toEqual([]);
    expect(sounds).toEqual(['tap']);
    feedback.configure({ haptics: true, muted: true });
    feedback.haptic('success');
    feedback.sound('tap');
    expect(haptics).toEqual([]);
    expect(sounds).toEqual(['tap']);
  });

  it('never throws when an adapter fails', () => {
    const feedback = createFeedback({
      haptics: { play: () => Promise.reject(new Error('no vibrator')) },
      sounds: { play: () => Promise.reject(new Error('no audio')) },
    });
    expect(() => {
      feedback.haptic('tap');
      feedback.sound('hatch');
    }).not.toThrow();
  });
});
