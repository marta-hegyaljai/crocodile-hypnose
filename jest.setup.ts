import { setUpTests } from 'react-native-reanimated';

// Reanimated: run animations synchronously in tests.
setUpTests();

// Device storage: the official in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Native-only feedback and media modules: silent fakes. Tests that care inject their own adapters.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-audio', () => {
  const makePlayer = () => ({
    id: 1,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    remove: jest.fn(),
    currentStatus: {
      isLoaded: false,
      playing: false,
      currentTime: 0,
      duration: 0,
      didJustFinish: false,
    },
  });
  const player = makePlayer();
  return {
    createAudioPlayer: jest.fn(() => makePlayer()),
    useAudioPlayer: jest.fn(() => player),
    useAudioPlayerStatus: jest.fn(() => player.currentStatus),
    setAudioModeAsync: jest.fn(async () => undefined),
  };
});

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({
    granted: true,
    status: 'granted',
    canAskAgain: true,
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    granted: true,
    status: 'granted',
    canAskAgain: true,
  })),
  scheduleNotificationAsync: jest.fn(async () => 'daily-reminder'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  setNotificationChannelAsync: jest.fn(async () => null),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  AndroidImportance: { DEFAULT: 3 },
}));
