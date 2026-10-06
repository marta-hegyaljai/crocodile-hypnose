import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type Text as RNText } from 'react-native';

import { t } from '@/copy';
import { describeAuthError, type DescribedError } from '@/features/auth/describeError';
import { holdUntil } from '@/features/auth/holdUntil';
import { useSubmit } from '@/features/auth/useSubmit';
import { LagoonSheetScreen } from '@/features/layout/LagoonSheetScreen';
import { type CrocExpression } from '@/illustration';
import { useAuth } from '@/services/auth';
import { useProfile } from '@/services/profile';
import { space } from '@/theme';
import { Button, Chip, Notice, Reveal, Text, moveFocus } from '@/ui';

const CELEBRATION_MS = 2800;

/**
 * Signed-in placeholder home (step 2): the user's hatchling greets you by name, with sign-out and
 * account deletion. The real home and river map arrive in step 4.
 */
export default function HomeScreen() {
  const user = useAuth((s) => s.user);
  const justSignedUp = useAuth((s) => s.justSignedUp);
  const acknowledgeSignUp = useAuth((s) => s.acknowledgeSignUp);
  const refreshProfile = useAuth((s) => s.refreshProfile);
  const signOut = useAuth((s) => s.signOut);
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const crocName = useProfile((s) => s.settings.crocName) ?? t('croc.defaultName');
  const flushProfile = useProfile((s) => s.flush);

  const [celebrating, setCelebrating] = useState(justSignedUp);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<DescribedError | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTitleRef = useRef<View>(null);
  const confirmTitleTextRef = useRef<RNText>(null);
  const deleteButtonRef = useRef<View>(null);
  const confirmOpened = useRef(false);

  // Focus follows the confirmation: into its title when it opens (so it is read out and Tab
  // reaches "Keep my account" before the destructive button), back to "Delete account" on cancel.
  useEffect(() => {
    if (confirmingDelete) {
      confirmOpened.current = true;
      moveFocus(confirmTitleRef.current ?? confirmTitleTextRef.current);
    } else if (confirmOpened.current) {
      confirmOpened.current = false;
      moveFocus(deleteButtonRef.current);
    }
  }, [confirmingDelete]);

  // Check the session and pick up profile changes made in the other MHP app.
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!justSignedUp) return;
    acknowledgeSignUp();
    timer.current = setTimeout(() => setCelebrating(false), CELEBRATION_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [justSignedUp, acknowledgeSignUp]);

  const signingOut = useSubmit(async () => {
    // Pending app data goes to the server first, while the token is still valid.
    await flushProfile();
    await signOut();
  });
  const deleting = useSubmit(async () => {
    const startedAt = Date.now();
    setDeleteError(null);
    try {
      await deleteAccount();
    } catch (err) {
      await holdUntil(startedAt);
      setDeleteError(describeAuthError(err));
    }
  });

  const name = user?.displayName || user?.email.split('@')[0] || '';
  const expression: CrocExpression = celebrating ? 'excited' : confirmingDelete ? 'calm' : 'happy';

  return (
    <LagoonSheetScreen
      testID="home-screen"
      expression={expression}
      stage="hatchling"
      crocName={crocName}
      celebrating={celebrating}
      header={({ landscape, leafSize }) => (
        // The greeting starts below the corner foliage (a long name spans the full width) and
        // clears the left cluster in landscape.
        <View
          style={[
            styles.top,
            landscape
              ? { alignItems: 'flex-start', paddingLeft: Math.round(leafSize * 0.7) }
              : { paddingTop: Math.max(0, Math.round(leafSize * 0.85) - space.md) },
          ]}
        >
          {celebrating ? (
            <Reveal offset={-10} style={landscape ? undefined : styles.centered}>
              <Chip label={t('home.accountCreated')} tone="celebrate" testID="home-celebrate" />
            </Reveal>
          ) : null}
          <Text
            variant="display"
            heading
            align={landscape ? 'left' : 'center'}
            placeholder
            numberOfLines={2}
            testID="home-greeting"
          >
            {t('home.greeting', { name })}
          </Text>
          <Text
            variant="body"
            tone="secondary"
            align={landscape ? 'left' : 'center'}
            testID="home-email"
          >
            {t('home.signedInAs', { email: user?.email ?? '' })}
          </Text>
        </View>
      )}
      sheet={
        confirmingDelete ? (
          <Reveal style={styles.block} testID="delete-confirm">
            <View
              ref={confirmTitleRef}
              tabIndex={-1}
              style={styles.focusTarget}
              testID="delete-confirm-title"
            >
              <Text variant="heading" heading ref={confirmTitleTextRef}>
                {t('account.deleteTitle')}
              </Text>
            </View>
            <Text variant="body" tone="secondary">
              {t('account.deleteBody')}
            </Text>
            {deleteError ? (
              <Notice
                tone="error"
                message={t(deleteError.key, deleteError.params)}
                testID="delete-error"
              />
            ) : null}
            {/* The safe choice comes first in reading and tab order. */}
            <Button
              label={t('account.deleteCancel')}
              variant="secondary"
              size="lg"
              fullWidth
              disabled={deleting.pending}
              onPress={() => {
                setConfirmingDelete(false);
                setDeleteError(null);
              }}
              testID="delete-cancel"
            />
            <Button
              label={t('account.deleteConfirm')}
              variant="danger"
              fullWidth
              loading={deleting.pending}
              onPress={() => void deleting.run()}
              testID="delete-confirm-button"
            />
          </Reveal>
        ) : (
          <View style={styles.block}>
            <Text variant="body" tone="secondary" align="center">
              {t('home.comingSoon')}
            </Text>
            <Button
              label={t('home.signOut')}
              variant="secondary"
              size="lg"
              fullWidth
              loading={signingOut.pending}
              onPress={() => void signingOut.run()}
              testID="home-sign-out"
            />
            <Button
              ref={deleteButtonRef}
              label={t('account.delete')}
              variant="ghost"
              fullWidth
              disabled={signingOut.pending}
              onPress={() => setConfirmingDelete(true)}
              testID="home-delete-account"
            />
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  centered: { alignSelf: 'center' },
  // Programmatic focus target only (tabIndex -1): no browser outline.
  focusTarget: { outlineWidth: 0 } as object,
  block: { gap: space.md },
});
