import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t, type CopyKey } from '@/copy';
import { ChoiceCard } from '@/features/onboarding/ChoiceCard';
import { cautionMode, safetyAnswered, stepComplete } from '@/features/onboarding/flow';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { useCrocReaction } from '@/features/onboarding/useCrocReaction';
import { useOnboardingActions, useStepScreen } from '@/features/onboarding/useOnboardingFlow';
import { useFeedback } from '@/services/feedback';
import { SAFETY_QUESTION_COUNT } from '@/services/profile/types';
import { radius, space, useTheme } from '@/theme';
import { Button, Card, Icon, Text } from '@/ui';

const QUESTION_KEYS: CopyKey[] = [
  'onboarding.safety.questions.1',
  'onboarding.safety.questions.2',
  'onboarding.safety.questions.3',
];

/**
 * Step 3: three yes/no questions. A "yes" leads to a calm information view that has to be
 * acknowledged once; the answers set `cautionMode` for later steps and are never shared.
 */
export default function SafetyScreen() {
  const { doc, redirect } = useStepScreen('safety');
  const { update, advance, back, shield } = useOnboardingActions();
  const [expression, react] = useCrocReaction();
  const [showInfo, setShowInfo] = useState(false);
  const feedback = useFeedback();
  const { colors } = useTheme();
  if (redirect) return <Redirect href={redirect} />;

  const caution = cautionMode(doc.safety.answers);

  const answer = (index: number, value: boolean) => {
    feedback.haptic('select');
    react('happy');
    void update((d) => {
      const answers = [...d.safety.answers];
      answers[index] = value;
      // Changing an answer asks for the information to be read again if it applies.
      return { ...d, safety: { answers, acknowledged: false } };
    });
  };

  const onContinue = () => {
    if (caution && !doc.safety.acknowledged) {
      // "I understand" arrives under the finger: a double tap must not acknowledge it unseen.
      shield();
      setShowInfo(true);
      return;
    }
    advance('safety');
  };

  const acknowledge = () => {
    void update((d) => ({ ...d, safety: { ...d.safety, acknowledged: true } }));
    advance('safety');
  };

  if (showInfo) {
    return (
      <OnboardingScaffold
        step="safety"
        title={t('onboarding.safety.infoTitle')}
        hero="egg"
        expression="calm"
        onBack={() => setShowInfo(false)}
        testID="onboarding-safety-info"
        footer={
          <Button
            label={t('onboarding.safety.infoAcknowledge')}
            size="lg"
            fullWidth
            onPress={acknowledge}
            testID="safety-acknowledge"
          />
        }
      >
        <Card tone="raised" padding="lg">
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="leaf" size={22} color={colors.primaryDeep} />
            </View>
            <Text variant="body" style={styles.flex} testID="safety-info-body">
              {t('onboarding.safety.infoBody')}
            </Text>
          </View>
        </Card>
        <Text variant="caption" tone="secondary" align="center">
          {t('onboarding.safety.privacy')}
        </Text>
      </OnboardingScaffold>
    );
  }

  return (
    <OnboardingScaffold
      step="safety"
      title={t('onboarding.safety.title')}
      subtitle={t('onboarding.safety.body')}
      hero="egg"
      expression={expression}
      onBack={() => back('safety')}
      testID="onboarding-safety"
      footer={
        <Button
          label={t('common.continue')}
          size="lg"
          fullWidth
          disabled={!safetyAnswered(doc) && !stepComplete('safety', doc)}
          onPress={onContinue}
          testID="onboarding-continue"
        />
      }
    >
      {QUESTION_KEYS.map((key, i) => (
        <View
          key={key}
          style={styles.question}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('onboarding.safety.a11yQuestion', {
            n: i + 1,
            total: SAFETY_QUESTION_COUNT,
          })}
        >
          <Text variant="bodyStrong" testID={`safety-question-${i + 1}`}>
            {t(key)}
          </Text>
          <View style={styles.row}>
            <ChoiceCard
              role="radio"
              label={t('onboarding.safety.yes')}
              selected={doc.safety.answers[i] === true}
              onPress={() => answer(i, true)}
              style={styles.half}
              testID={`safety-${i + 1}-yes`}
            />
            <ChoiceCard
              role="radio"
              label={t('onboarding.safety.no')}
              selected={doc.safety.answers[i] === false}
              onPress={() => answer(i, false)}
              style={styles.half}
              testID={`safety-${i + 1}-no`}
            />
          </View>
        </View>
      ))}
      <View style={[styles.privacy, { backgroundColor: colors.surfaceRaised }]}>
        <Icon name="lock" size={18} color={colors.textSecondary} />
        <Text variant="caption" tone="secondary" style={styles.flex}>
          {t('onboarding.safety.privacy')}
        </Text>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  question: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  infoRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
