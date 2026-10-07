import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t, type CopyKey } from '@/copy';
import { ChoiceCard } from '@/features/onboarding/ChoiceCard';
import { cautionMode } from '@/features/onboarding/flow';
import { useProfile } from '@/services/profile';
import { SAFETY_QUESTION_COUNT, type SafetyAnswers } from '@/services/profile/types';
import { space } from '@/theme';
import { Button, Card, Notice, RadioGroup, Text } from '@/ui';

import { setSafetyAnswers } from './settingsLogic';

const QUESTION_KEYS: CopyKey[] = [
  'onboarding.safety.questions.1',
  'onboarding.safety.questions.2',
  'onboarding.safety.questions.3',
];

/**
 * Re-take the safety check. Saving writes the answers and the caution mode that follows into the
 * settings (the river map and today's session follow at once). A "yes" shows the safety
 * information first, as in onboarding.
 */
export function SafetyRetake() {
  const saved = useProfile((s) => s.settings.safety);
  const updateSettings = useProfile((s) => s.updateSettings);
  const updateOnboarding = useProfile((s) => s.updateOnboarding);
  const [answers, setAnswers] = useState<SafetyAnswers>(() => [...saved.answers]);
  const [informing, setInforming] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);

  const complete = answers.length === SAFETY_QUESTION_COUNT && answers.every((a) => a !== null);
  const changed = answers.some((a, i) => a !== saved.answers[i]);

  const save = () => {
    setInforming(false);
    void updateSettings((doc) => setSafetyAnswers(doc, answers));
    // The onboarding copy backs the safety gate on a device whose settings have not arrived yet:
    // keep it from contradicting the new answers.
    void updateOnboarding((doc) => ({
      ...doc,
      safety: { answers: [...answers], acknowledged: cautionMode(answers) },
    }));
    setResult(cautionMode(answers));
  };

  const onSave = () => {
    if (cautionMode(answers)) setInforming(true);
    else save();
  };

  const answer = (index: number, value: boolean) => {
    setResult(null);
    setInforming(false);
    setAnswers((current) => current.map((a, i) => (i === index ? value : a)));
  };

  if (informing) {
    return (
      <Card tone="raised" padding="lg" testID="retake-info">
        <View style={styles.stack}>
          <Text variant="subheading" heading={2}>
            {t('help.retakeInfoTitle')}
          </Text>
          <Text variant="body" testID="retake-info-body">
            {t('onboarding.safety.infoBody')}
          </Text>
          <Button
            label={t('onboarding.safety.infoAcknowledge')}
            size="lg"
            fullWidth
            onPress={save}
            testID="retake-acknowledge"
          />
          <Button
            label={t('common.cancel')}
            variant="ghost"
            fullWidth
            onPress={() => setInforming(false)}
            testID="retake-info-cancel"
          />
        </View>
      </Card>
    );
  }

  return (
    <View style={styles.stack}>
      <Text variant="subheading" heading={2}>
        {t('help.retakeTitle')}
      </Text>
      <Text variant="body" tone="secondary">
        {t('help.retakeIntro')}
      </Text>
      {QUESTION_KEYS.map((key, i) => (
        <RadioGroup
          key={key}
          label={t('onboarding.safety.a11yQuestion', { n: i + 1, total: SAFETY_QUESTION_COUNT })}
          style={styles.stack}
        >
          <Text variant="bodyStrong">{t(key)}</Text>
          <View style={styles.row}>
            <ChoiceCard
              role="radio"
              label={t('onboarding.safety.yes')}
              selected={answers[i] === true}
              onPress={() => answer(i, true)}
              style={styles.half}
              testID={`retake-${i + 1}-yes`}
            />
            <ChoiceCard
              role="radio"
              label={t('onboarding.safety.no')}
              selected={answers[i] === false}
              onPress={() => answer(i, false)}
              style={styles.half}
              testID={`retake-${i + 1}-no`}
            />
          </View>
        </RadioGroup>
      ))}
      <Button
        label={t('help.retakeSave')}
        size="lg"
        fullWidth
        disabled={!complete || !changed}
        onPress={onSave}
        testID="retake-save"
      />
      {result !== null ? (
        <Notice
          tone="success"
          title={t('help.retakeSaved')}
          message={result ? t('help.cautionOn') : t('help.cautionOff')}
          testID="retake-result"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
});
