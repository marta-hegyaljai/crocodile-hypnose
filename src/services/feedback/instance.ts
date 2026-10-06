import { appProfileStore } from '@/services/profile/instance';

import { createDeviceSounds, deviceHaptics } from './adapters';
import { createFeedback } from './feedback';

/** The app's feedback: device haptics and sounds, following the user's settings. */
export const appFeedback = createFeedback({ haptics: deviceHaptics, sounds: createDeviceSounds() });

const applySettings = () => {
  const { settings } = appProfileStore.getState();
  appFeedback.configure({ haptics: settings.haptics, sound: settings.sound });
};
applySettings();
appProfileStore.subscribe(applySettings);
