import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { ChoiceCard } from '@/features/onboarding/ChoiceCard';
import { REMINDER_TIMES } from '@/features/onboarding/flow';
import { useMotionSettings } from '@/motion/MotionProvider';
import { useProfile } from '@/services/profile';
import type { SessionLength } from '@/services/profile/types';
import { reminders } from '@/services/reminders/reminders';
import { space } from '@/theme';
import { Notice, Text, TextField, ToggleRow } from '@/ui';

import { isValidTime, setReminderEnabled, setReminderTime, timeOfDayOf } from './settingsLogic';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="subheading" heading>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Daily reminder: on/off and the time (morning, evening, or any HH:MM). */
export function ReminderSettings() {
  const reminder = useProfile((s) => s.settings.reminder);
  const updateSettings = useProfile((s) => s.updateSettings);
  const [text, setText] = useState(reminder.time ?? '');
  // Another device (or tab) changed the time: show it (state derived from the stored time).
  const [seen, setSeen] = useState(reminder.time);
  if (reminder.time !== seen) {
    setSeen(reminder.time);
    setText(reminder.time ?? '');
  }
  const invalid = text !== '' && !isValidTime(text);
  const current = reminder.time ? timeOfDayOf(reminder.time) : null;

  const pick = (time: string) => {
    setText(time);
    void updateSettings((doc) => setReminderTime(doc, time));
  };

  return (
    <Group title={t('profile.reminderTitle')}>
      <ToggleRow
        label={t('profile.reminderToggle')}
        value={reminder.enabled}
        onValueChange={(on) => void updateSettings((doc) => setReminderEnabled(doc, on))}
        testID="setting-reminder"
      />
      {reminder.enabled ? (
        <View style={styles.group}>
          <View style={styles.row}>
            <ChoiceCard
              role="radio"
              label={t('profile.reminderMorning')}
              detail={REMINDER_TIMES.morning}
              selected={current === 'morning' && reminder.time === REMINDER_TIMES.morning}
              onPress={() => pick(REMINDER_TIMES.morning)}
              style={styles.half}
              testID="reminder-morning"
            />
            <ChoiceCard
              role="radio"
              label={t('profile.reminderEvening')}
              detail={REMINDER_TIMES.evening}
              selected={current === 'evening' && reminder.time === REMINDER_TIMES.evening}
              onPress={() => pick(REMINDER_TIMES.evening)}
              style={styles.half}
              testID="reminder-evening"
            />
          </View>
          <TextField
            label={t('profile.reminderTimeLabel')}
            hint={t('profile.reminderTimeHint')}
            error={invalid ? t('profile.reminderTimeInvalid') : null}
            value={text}
            onChangeText={(value) => {
              setText(value);
              if (isValidTime(value)) void updateSettings((doc) => setReminderTime(doc, value));
            }}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            testID="reminder-time"
          />
        </View>
      ) : null}
      {!reminders.supported ? (
        <Text variant="caption" tone="secondary" testID="reminder-unsupported">
          {t('profile.reminderUnsupported')}
        </Text>
      ) : null}
    </Group>
  );
}

/** Sounds, haptics, default session length and motion: each takes effect at once. */
export function PreferenceSettings() {
  const settings = useProfile((s) => s.settings);
  const updateSettings = useProfile((s) => s.updateSettings);
  const motion = settings.reducedMotion ?? null;
  const lengths: { value: SessionLength; label: string }[] = [
    { value: 'short', label: t('onboarding.experience.short') },
    { value: 'medium', label: t('onboarding.experience.medium') },
    { value: 'long', label: t('onboarding.experience.long') },
  ];
  const motions: { value: boolean | null; label: string; id: string }[] = [
    { value: null, label: t('profile.motionFollow'), id: 'follow' },
    { value: true, label: t('profile.motionReduce'), id: 'reduce' },
    { value: false, label: t('profile.motionFull'), id: 'full' },
  ];
  return (
    <>
      <Group title={t('profile.settingsTitle')}>
        <ToggleRow
          label={t('profile.soundToggle')}
          value={settings.sound}
          onValueChange={(on) => void updateSettings((doc) => ({ ...doc, sound: on }))}
          testID="setting-sound"
        />
        <ToggleRow
          label={t('profile.hapticsToggle')}
          value={settings.haptics}
          onValueChange={(on) => void updateSettings((doc) => ({ ...doc, haptics: on }))}
          testID="setting-haptics"
        />
        <MoodConsentSetting />
      </Group>
      <Group title={t('profile.lengthTitle')}>
        <View style={styles.column} accessibilityRole="radiogroup">
          {lengths.map((l) => (
            <ChoiceCard
              key={l.value}
              role="radio"
              label={l.label}
              selected={settings.sessionLength === l.value}
              onPress={() =>
                void updateSettings((doc) =>
                  doc.sessionLength === l.value ? doc : { ...doc, sessionLength: l.value },
                )
              }
              testID={`setting-length-${l.value}`}
            />
          ))}
        </View>
      </Group>
      <Group title={t('profile.motionTitle')}>
        <View style={styles.column} accessibilityRole="radiogroup">
          {motions.map((m) => (
            <ChoiceCard
              key={m.id}
              role="radio"
              label={m.label}
              selected={motion === m.value}
              onPress={() =>
                void updateSettings((doc) =>
                  (doc.reducedMotion ?? null) === m.value
                    ? doc
                    : { ...doc, reducedMotion: m.value },
                )
              }
              testID={`setting-motion-${m.id}`}
            />
          ))}
        </View>
      </Group>
    </>
  );
}

/** Mood consent. Off deletes the stored entries (device and server); the screen says so. */
function MoodConsentSetting() {
  const consent = useProfile((s) => s.settings.moodConsent);
  const setMoodConsent = useProfile((s) => s.setMoodConsent);
  const [deleted, setDeleted] = useState(false);
  return (
    <>
      <ToggleRow
        label={t('profile.moodToggle')}
        detail={t('profile.moodDetail')}
        value={consent}
        onValueChange={(on) => {
          setDeleted(!on);
          void setMoodConsent(on);
        }}
        testID="setting-mood"
      />
      {deleted && !consent ? (
        <Notice tone="success" message={t('profile.moodDeleted')} testID="mood-deleted" />
      ) : null}
    </>
  );
}

/** Applies the settings' reduced-motion choice to the app's motion override. */
export function MotionFollowsSettings() {
  const choice = useProfile((s) => s.settings.reducedMotion ?? null);
  const { setOverride } = useMotionSettings();
  useEffect(() => setOverride(choice), [choice, setOverride]);
  return null;
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  column: { gap: space.sm },
  half: { flex: 1 },
});
