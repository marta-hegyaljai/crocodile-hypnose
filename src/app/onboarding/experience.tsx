import { Redirect } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t, type CopyKey } from '@/copy';
import { ChoiceCard } from '@/features/onboarding/ChoiceCard';
import { stepComplete } from '@/features/onboarding/flow';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { useCrocReaction } from '@/features/onboarding/useCrocReaction';
import { useOnboardingActions, useStepScreen } from '@/features/onboarding/useOnboardingFlow';
import { useFeedback } from '@/services/feedback';
import type { Experience, SessionLength, TimeOfDay } from '@/services/profile/types';
import { space } from '@/theme';
import { Button, Text } from '@/ui';

const EXPERIENCE: { value: Experience; key: CopyKey }[] = [
  { value: 'new', key: 'onboarding.experience.new' },
  { value: 'experienced', key: 'onboarding.experience.experienced' },
];
const TIME: { value: TimeOfDay; key: CopyKey }[] = [
  { value: 'morning', key: 'onboarding.experience.morning' },
  { value: 'evening', key: 'onboarding.experience.evening' },
];
const LENGTH: { value: SessionLength; key: CopyKey; detail: CopyKey }[] = [
  {
    value: 'short',
    key: 'onboarding.experience.short',
    detail: 'onboarding.experience.shortDetail',
  },
  {
    value: 'medium',
    key: 'onboarding.experience.medium',
    detail: 'onboarding.experience.mediumDetail',
  },
  { value: 'long', key: 'onboarding.experience.long', detail: 'onboarding.experience.longDetail' },
];

/** Step 2: experience, time of day and session length. Sets session and reminder defaults. */
export default function ExperienceScreen() {
  const { doc, redirect } = useStepScreen('experience');
  const { update, advance, back } = useOnboardingActions();
  const [expression, react] = useCrocReaction();
  const feedback = useFeedback();
  if (redirect) return <Redirect href={redirect} />;

  const choose = (change: Parameters<typeof update>[0]) => {
    feedback.haptic('select');
    react('happy');
    void update(change);
  };

  return (
    <OnboardingScaffold
      step="experience"
      title={t('onboarding.experience.title')}
      hero="egg"
      expression={expression}
      onBack={() => back('experience')}
      testID="onboarding-experience"
      footer={
        <Button
          label={t('common.continue')}
          size="lg"
          fullWidth
          disabled={!stepComplete('experience', doc)}
          onPress={() => advance('experience')}
          testID="onboarding-continue"
        />
      }
    >
      <View style={styles.group} accessibilityRole="radiogroup">
        <Text variant="label" tone="secondary">
          {t('onboarding.experience.experienceQuestion')}
        </Text>
        <View style={styles.row}>
          {EXPERIENCE.map((o) => (
            <ChoiceCard
              key={o.value}
              role="radio"
              label={t(o.key)}
              selected={doc.experience === o.value}
              onPress={() => choose((d) => ({ ...d, experience: o.value }))}
              style={styles.half}
              testID={`experience-${o.value}`}
            />
          ))}
        </View>
      </View>
      <View style={styles.group} accessibilityRole="radiogroup">
        <Text variant="label" tone="secondary">
          {t('onboarding.experience.timeQuestion')}
        </Text>
        <View style={styles.row}>
          {TIME.map((o) => (
            <ChoiceCard
              key={o.value}
              role="radio"
              label={t(o.key)}
              selected={doc.timeOfDay === o.value}
              onPress={() => choose((d) => ({ ...d, timeOfDay: o.value }))}
              style={styles.half}
              testID={`time-${o.value}`}
            />
          ))}
        </View>
      </View>
      <View style={styles.group} accessibilityRole="radiogroup">
        <Text variant="label" tone="secondary">
          {t('onboarding.experience.lengthQuestion')}
        </Text>
        {LENGTH.map((o) => (
          <ChoiceCard
            key={o.value}
            role="radio"
            label={t(o.key)}
            detail={t(o.detail)}
            selected={doc.sessionLength === o.value}
            onPress={() => choose((d) => ({ ...d, sessionLength: o.value }))}
            testID={`length-${o.value}`}
          />
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
});
