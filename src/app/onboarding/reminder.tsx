import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { useSubmit } from '@/features/auth/useSubmit';
import { REMINDER_TIMES } from '@/features/onboarding/flow';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { useCrocReaction } from '@/features/onboarding/useCrocReaction';
import { useOnboardingActions, useStepScreen } from '@/features/onboarding/useOnboardingFlow';
import { useFeedback } from '@/services/feedback';
import { reminders } from '@/services/reminders/reminders';
import { space, useTheme } from '@/theme';
import { Button, Chip, Notice } from '@/ui';

/**
 * Step 7: reminder opt-in, asked only now. Native schedules a daily local notification at the
 * time the timing step implied; the web explains that it cannot. Skippable.
 */
export default function ReminderScreen() {
  const { doc, redirect } = useStepScreen('reminder');
  const { update, advance, back } = useOnboardingActions();
  const [expression, react] = useCrocReaction('happy');
  const [denied, setDenied] = useState(false);
  const feedback = useFeedback();
  const { colors } = useTheme();

  const time = REMINDER_TIMES[doc.timeOfDay ?? 'evening'];
  const supported = reminders.supported;

  // The permission is asked here; the OS reminder itself follows the settings document
  // (src/services/reminders/reminderSync), so it is also rescheduled or cancelled later.
  const enabling = useSubmit(async () => {
    let permission: Awaited<ReturnType<typeof reminders.requestPermission>>;
    try {
      permission = await reminders.requestPermission();
    } catch {
      permission = 'unavailable';
    }
    if (permission === 'granted') {
      feedback.haptic('success');
      react('excited');
      void update((d) => ({ ...d, reminder: 'enabled' }));
      advance('reminder');
      return;
    }
    if (permission === 'denied') {
      setDenied(true);
      return;
    }
    void update((d) => ({ ...d, reminder: 'unavailable' }));
    advance('reminder');
  });

  if (redirect) return <Redirect href={redirect} />;

  const skip = () => {
    void update((d) => ({ ...d, reminder: supported ? 'skipped' : 'unavailable' }));
    advance('reminder');
  };

  return (
    <OnboardingScaffold
      step="reminder"
      title={t('onboarding.reminder.title')}
      subtitle={t('onboarding.reminder.body')}
      hero="hatchling"
      expression={expression}
      crocName={doc.crocName ?? undefined}
      onBack={() => back('reminder')}
      backDisabled={enabling.pending}
      testID="onboarding-reminder"
      footer={
        <View style={styles.buttons}>
          {supported && !denied ? (
            <Button
              label={t('onboarding.reminder.enable')}
              size="lg"
              fullWidth
              loading={enabling.pending}
              onPress={() => void enabling.run()}
              testID="reminder-enable"
            />
          ) : null}
          <Button
            label={supported && !denied ? t('onboarding.reminder.skip') : t('common.continue')}
            variant={supported && !denied ? 'ghost' : 'primary'}
            size="lg"
            fullWidth
            disabled={enabling.pending}
            onPress={skip}
            testID="reminder-skip"
          />
        </View>
      }
    >
      <Chip
        label={t('onboarding.reminder.time', { time })}
        tone={supported ? 'goal' : 'neutral'}
        icon={supported ? 'sparkle' : undefined}
        style={[styles.time, supported && { backgroundColor: colors.primarySoft }]}
        testID="reminder-time"
      />
      {!supported ? (
        <Notice
          tone="info"
          message={t('onboarding.reminder.webUnavailable')}
          testID="reminder-web"
        />
      ) : null}
      {denied ? (
        <Notice tone="info" message={t('onboarding.reminder.denied')} testID="reminder-denied" />
      ) : null}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: space.sm },
  time: { alignSelf: 'center', minHeight: 40, paddingHorizontal: space.lg },
});
