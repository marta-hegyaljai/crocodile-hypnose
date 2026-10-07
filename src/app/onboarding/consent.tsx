import { Redirect } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { t } from '@/copy';
import { ChoiceCard } from '@/features/onboarding/ChoiceCard';
import { stepComplete } from '@/features/onboarding/flow';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { useCrocReaction } from '@/features/onboarding/useCrocReaction';
import { useOnboardingActions, useStepScreen } from '@/features/onboarding/useOnboardingFlow';
import { useFeedback } from '@/services/feedback';
import { space, useTheme } from '@/theme';
import { Button, Icon, RadioGroup, Text } from '@/ui';

/** Step 4: explicit opt-in for storing mood check-ins (health data). The app works without it. */
export default function ConsentScreen() {
  const { doc, redirect } = useStepScreen('consent');
  const { update, advance, back } = useOnboardingActions();
  const [expression, react] = useCrocReaction();
  const feedback = useFeedback();
  const { colors } = useTheme();
  if (redirect) return <Redirect href={redirect} />;

  const choose = (value: boolean) => {
    feedback.haptic('select');
    react('happy');
    void update((d) => ({
      ...d,
      moodConsent: value,
      // Health data: withdrawing consent forgets any mood values already recorded.
      firstSession: value
        ? d.firstSession
        : { ...d.firstSession, moodBefore: null, moodAfter: null },
    }));
  };

  return (
    <OnboardingScaffold
      step="consent"
      title={t('onboarding.consent.title')}
      subtitle={t('onboarding.consent.body')}
      hero="egg"
      expression={expression}
      onBack={() => back('consent')}
      testID="onboarding-consent"
      footer={
        <Button
          label={t('common.continue')}
          size="lg"
          fullWidth
          disabled={!stepComplete('consent', doc)}
          onPress={() => advance('consent')}
          testID="onboarding-continue"
        />
      }
    >
      <RadioGroup label={t('onboarding.consent.title')} style={styles.options}>
        <ChoiceCard
          role="radio"
          label={t('onboarding.consent.allow')}
          detail={t('onboarding.consent.allowDetail')}
          icon={<Icon name="drop" size={26} color={colors.water} />}
          selected={doc.moodConsent === true}
          onPress={() => choose(true)}
          testID="consent-allow"
        />
        <ChoiceCard
          role="radio"
          label={t('onboarding.consent.decline')}
          detail={t('onboarding.consent.declineDetail')}
          icon={<Icon name="close" size={24} color={colors.textSecondary} />}
          selected={doc.moodConsent === false}
          onPress={() => choose(false)}
          testID="consent-decline"
        />
      </RadioGroup>
      <Text variant="caption" tone="secondary" align="center">
        {t('onboarding.consent.note')}
      </Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  options: { gap: space.md },
});
