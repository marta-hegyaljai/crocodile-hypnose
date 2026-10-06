import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { ONBOARDING_POINTS } from '@/features/onboarding/flow';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { useOnboardingActions, useStepScreen } from '@/features/onboarding/useOnboardingFlow';
import { useFeedback } from '@/services/feedback';
import { space } from '@/theme';
import { Button, Chip, Reveal } from '@/ui';

const CELEBRATION_MS = 2800;

/** Step 8: the celebration, the first points, and off to home. */
export default function DoneScreen() {
  const { doc, redirect } = useStepScreen('done');
  const { finish } = useOnboardingActions();
  const feedback = useFeedback();
  const [celebrating, setCelebrating] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    feedback.haptic('success');
    const timer = setTimeout(() => setCelebrating(false), CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (redirect) return <Redirect href={redirect} />;

  const name = doc.crocName ?? t('croc.defaultName');

  return (
    <OnboardingScaffold
      step="done"
      title={t('onboarding.done.title')}
      subtitle={t('onboarding.done.body')}
      hero="hatchling"
      expression="excited"
      crocName={name}
      celebrating={celebrating}
      testID="onboarding-done"
      footer={
        <Button
          label={t('onboarding.done.goHome')}
          size="lg"
          fullWidth
          loading={leaving}
          onPress={() => {
            if (leaving) return;
            setLeaving(true);
            finish();
          }}
          testID="onboarding-finish"
        />
      }
    >
      <View style={styles.chips}>
        <Reveal offset={-10} delay={200}>
          <Chip
            label={t('onboarding.done.points', { n: ONBOARDING_POINTS })}
            tone="points"
            placeholder
            style={styles.chip}
            testID="done-points"
          />
        </Reveal>
        <Reveal offset={-10} delay={420}>
          <Chip
            label={t('onboarding.done.crocReady', { name })}
            tone="celebrate"
            placeholder
            style={styles.chip}
            testID="done-croc"
          />
        </Reveal>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  chips: { alignItems: 'center', gap: space.md },
  chip: { minHeight: 40, paddingHorizontal: space.lg },
});
