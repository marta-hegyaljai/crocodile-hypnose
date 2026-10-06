/** Daily reminder as a local notification through expo-notifications (iOS and Android). */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { parseReminderTime, type Reminders } from './types';

const CHANNEL_ID = 'reminders';
/** The app's one daily reminder: scheduling again replaces it. */
const IDENTIFIER = 'daily-reminder';

async function ensureChannel(name: string) {
  // Android 13+: the channel must exist before the permission is requested.
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function permission(): Promise<'granted' | 'denied'> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain && current.status === 'denied') return 'denied';
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted ? 'granted' : 'denied';
}

export const reminders: Reminders = {
  supported: true,
  async requestPermission() {
    try {
      await ensureChannel('Reminders');
      return await permission();
    } catch {
      return 'unavailable';
    }
  },
  async schedule(time, content) {
    const parsed = parseReminderTime(time);
    if (!parsed) return { status: 'unavailable' };
    try {
      await ensureChannel(content.title);
      if ((await permission()) !== 'granted') return { status: 'denied' };
      await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => undefined);
      await Notifications.scheduleNotificationAsync({
        identifier: IDENTIFIER,
        content: { title: content.title, body: content.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: parsed.hour,
          minute: parsed.minute,
          channelId: CHANNEL_ID,
        },
      });
      return { status: 'scheduled' };
    } catch {
      return { status: 'unavailable' };
    }
  },
  async cancel() {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => undefined);
  },
};

export type { ReminderContent, ReminderResult, Reminders } from './types';
export { parseReminderTime } from './types';
