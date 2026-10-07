import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { localContent } from '@/content/repository';
import { checkCrocName, crocNameProblemText } from '@/features/onboarding/flow';
import { useJourney } from '@/features/home/useJourney';
import { Croc } from '@/illustration';
import { useAuth } from '@/services/auth';
import { useProfile } from '@/services/profile';
import { palette, radius, space, useTheme } from '@/theme';
import { Button, Card, Notice, Text, TextField } from '@/ui';

import { Section } from './Section';
import { summarize } from './settingsLogic';

/**
 * The croc hosts the page: its name is the title (level 1), the account email sits under it in
 * full (it wraps rather than clips, so the account is verifiable before export or delete).
 */
export function ProfileHeader() {
  const user = useAuth((s) => s.user);
  const crocName = useProfile((s) => s.settings.crocName) ?? t('croc.defaultName');
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={[styles.avatar, { borderColor: colors.surfaceRaised }]}>
        <Croc
          stage="hatchling"
          pose="peek"
          water="inline"
          width={96}
          expression="happy"
          name={crocName}
          animated={false}
          relativeSize={false}
        />
      </View>
      <View style={styles.headerText}>
        <Text variant="title" heading={1} numberOfLines={2} testID="profile-croc-name">
          {crocName}
        </Text>
        <Text variant="caption" tone="secondary" style={styles.email} testID="profile-email">
          {t('home.signedInAs', { email: user?.email ?? '' })}
        </Text>
      </View>
    </View>
  );
}

/** Calm minutes, sessions and the stage the user is in. */
export function ProfileSummaryCard() {
  const sessions = useProfile((s) => s.sessions);
  const { journey } = useJourney();
  const summary = summarize(sessions, journey, localContent);
  const { colors } = useTheme();
  const stage = summary.stageZone ? t(`zones.${summary.stageZone}`) : t('profile.stageDone');
  const items = [
    {
      id: 'minutes',
      label: t('profile.calmMinutes'),
      value: t('profile.minutesValue', { n: summary.calmMinutes }),
    },
    { id: 'sessions', label: t('profile.sessions'), value: String(summary.sessions) },
    { id: 'stage', label: t('profile.currentStage'), value: stage },
  ];
  return (
    <Card tone="raised" padding="md" testID="profile-summary">
      <Text variant="subheading" heading={2} style={styles.summaryTitle}>
        {t('profile.summaryTitle')}
      </Text>
      <View style={styles.stats}>
        {items.map((item) => (
          <View
            key={item.id}
            style={[styles.stat, { borderColor: colors.border }]}
            accessible
            accessibilityLabel={`${item.label}: ${item.value}`}
          >
            <Text variant="heading" numberOfLines={1} testID={`profile-stat-${item.id}`}>
              {item.value}
            </Text>
            <Text variant="caption" tone="secondary">
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Rename the croc (kept in the settings document, so every device shows it). */
export function RenameCroc() {
  const saved = useProfile((s) => s.settings.crocName);
  const updateSettings = useProfile((s) => s.updateSettings);
  const [text, setText] = useState(saved ?? '');
  const [done, setDone] = useState(false);
  // Another device (or tab) renamed the croc: show it (state derived from the stored name).
  const [seen, setSeen] = useState(saved);
  if (saved !== seen) {
    setSeen(saved);
    setText(saved ?? '');
  }

  const check = checkCrocName(text);
  const [touched, setTouched] = useState(false);
  const problem = touched && !check.ok ? crocNameProblemText(check.problem) : null;
  const unchanged = check.ok && check.name === saved;

  const save = () => {
    setTouched(true);
    if (!check.ok || unchanged) return;
    void updateSettings((doc) => ({ ...doc, crocName: check.name }));
    setDone(true);
  };

  return (
    <Section title={t('profile.renameTitle')}>
      <TextField
        label={t('profile.nameLabel')}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setDone(false);
        }}
        error={problem}
        returnKeyType="done"
        onSubmitEditing={save}
        testID="profile-name"
      />
      <Button
        label={t('profile.nameSave')}
        variant="secondary"
        fullWidth
        disabled={unchanged}
        onPress={save}
        testID="profile-name-save"
      />
      {done && unchanged ? (
        <Notice tone="success" message={t('profile.nameSaved')} testID="profile-name-saved" />
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    backgroundColor: palette.shallows,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0, gap: space.xxs },
  // A long address breaks inside the word instead of being clipped (web only; native wraps).
  email: Platform.select({ web: { wordBreak: 'break-word' } as object, default: {} }),
  summaryTitle: { marginBottom: space.sm },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    gap: space.xxs,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
});
