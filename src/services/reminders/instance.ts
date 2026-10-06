import { t } from '@/copy';
import { appProfileStore } from '@/services/profile/instance';

import { createReminderSync } from './reminderSync';
import { reminders } from './reminders';

/** The OS reminder follows the settings document (scheduled, rescheduled, cancelled on sign-out). */
createReminderSync({
  profile: appProfileStore,
  reminders,
  content: () => ({
    title: t('onboarding.reminder.notificationTitle'),
    body: t('onboarding.reminder.notificationBody'),
  }),
});
