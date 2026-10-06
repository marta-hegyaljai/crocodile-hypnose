import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { ChoiceCard } from '@/features/onboarding/ChoiceCard';
import { GOALS_MAX, stepComplete, toggleGoal } from '@/features/onboarding/flow';
import { GoalIcon } from '@/features/onboarding/GoalIcon';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { useCrocReaction } from '@/features/onboarding/useCrocReaction';
import { useOnboardingActions, useStepScreen } from '@/features/onboarding/useOnboardingFlow';
import { useAuth } from '@/services/auth';
import { useFeedback } from '@/services/feedback';
import { GOALS } from '@/services/profile/types';
import { space } from '@/theme';
import { Button, Notice, Text } from '@/ui';

/** Step 1: pick one or two goals. Sets the recommended starting zone. */
export default function GoalsScreen() {
  const { doc, redirect } = useStepScreen('goals');
  const { update, advance } = useOnboardingActions();
  const [expression, react] = useCrocReaction();
  const [limitHit, setLimitHit] = useState(false);
  const [nudged, setNudged] = useState<{ goal: string; count: number } | null>(null);
  const feedback = useFeedback();
  const acknowledgeSignUp = useAuth((s) => s.acknowledgeSignUp);

  // The sign-up celebration happens here, at the end of onboarding, not on home.
  useEffect(() => {
    acknowledgeSignUp();
  }, [acknowledgeSignUp]);

  if (redirect) return <Redirect href={redirect} />;

  const pick = (goal: (typeof GOALS)[number]) => {
    const result = toggleGoal(doc.goals, goal);
    if (result.refused) {
      // Refused: the card shakes its head, the egg reacts, and the reason sits by the button.
      setLimitHit(true);
      setNudged((n) => ({ goal, count: (n?.count ?? 0) + 1 }));
      feedback.haptic('tap');
      react('calm');
      return;
    }
    setLimitHit(false);
    feedback.haptic('select');
    react(result.goals.length > doc.goals.length ? 'happy' : 'calm');
    void update((d) => ({ ...d, goals: result.goals }));
  };

  return (
    <OnboardingScaffold
      step="goals"
      title={t('onboarding.goals.title')}
      subtitle={t('onboarding.goals.body')}
      hero="egg"
      expression={expression}
      testID="onboarding-goals"
      footer={
        <View style={styles.footer}>
          {limitHit ? (
            <Notice
              tone="info"
              message={t('onboarding.goals.limit', { max: GOALS_MAX })}
              testID="goals-limit"
            />
          ) : null}
          <Button
            label={t('common.continue')}
            size="lg"
            fullWidth
            disabled={!stepComplete('goals', doc)}
            onPress={() => advance('goals')}
            testID="onboarding-continue"
          />
        </View>
      }
    >
      <View style={styles.grid}>
        {GOALS.map((goal) => (
          <ChoiceCard
            key={goal}
            tile
            label={t(`zones.${goal}`)}
            placeholder
            icon={<GoalIcon goal={goal} selected={doc.goals.includes(goal)} />}
            selected={doc.goals.includes(goal)}
            onPress={() => pick(goal)}
            nudge={nudged?.goal === goal ? nudged.count : 0}
            testID={`goal-${goal}`}
          />
        ))}
      </View>
      <Text variant="caption" tone="secondary" align="center" testID="goals-picked">
        {t('onboarding.goals.picked', { n: doc.goals.length, max: GOALS_MAX })}
      </Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
  footer: { gap: space.md },
});
