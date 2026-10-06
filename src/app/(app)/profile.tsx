import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type Text as RNText } from 'react-native';

import { t } from '@/copy';
import { describeAuthError, type DescribedError } from '@/features/auth/describeError';
import { holdUntil } from '@/features/auth/holdUntil';
import { useSubmit } from '@/features/auth/useSubmit';
import { TabPlaceholder } from '@/features/home/TabPlaceholder';
import { useAuth } from '@/services/auth';
import { useProfile } from '@/services/profile';
import { radius, space, useTheme } from '@/theme';
import { Button, Notice, Reveal, Text, moveFocus } from '@/ui';

/**
 * Profile (placeholder until step 8): who is signed in, sign out and account deletion (moved
 * here from the step 2 home).
 */
export default function ProfileTab() {
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const flushProfile = useProfile((s) => s.flush);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<DescribedError | null>(null);
  const confirmTitleRef = useRef<View>(null);
  const confirmTitleTextRef = useRef<RNText>(null);
  const deleteButtonRef = useRef<View>(null);
  const confirmOpened = useRef(false);

  // Focus follows the confirmation: into its title when it opens, back to "Delete account" on cancel.
  useEffect(() => {
    if (confirmingDelete) {
      confirmOpened.current = true;
      moveFocus(confirmTitleRef.current ?? confirmTitleTextRef.current);
    } else if (confirmOpened.current) {
      confirmOpened.current = false;
      moveFocus(deleteButtonRef.current);
    }
  }, [confirmingDelete]);

  const signingOut = useSubmit(async () => {
    // Pending app data (progress included) goes to the server first, while the token is valid.
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

  return (
    <TabPlaceholder
      title={t('tabs.profile')}
      message={t('tabsPlaceholder.profile')}
      expression={confirmingDelete ? 'calm' : 'happy'}
      testID="profile-screen"
    >
      <View style={[styles.panel, { backgroundColor: colors.surface }]}>
        <Text variant="body" tone="secondary" align="center" testID="profile-email">
          {t('home.signedInAs', { email: user?.email ?? '' })}
        </Text>
        {confirmingDelete ? (
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
            <Button
              label={t('home.signOut')}
              variant="secondary"
              size="lg"
              fullWidth
              loading={signingOut.pending}
              onPress={() => void signingOut.run()}
              testID="profile-sign-out"
            />
            <Button
              ref={deleteButtonRef}
              label={t('account.delete')}
              variant="ghost"
              fullWidth
              disabled={signingOut.pending}
              onPress={() => setConfirmingDelete(true)}
              testID="profile-delete-account"
            />
          </View>
        )}
      </View>
    </TabPlaceholder>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.lg, padding: space.lg, gap: space.md, marginTop: space.lg },
  // Programmatic focus target only (tabIndex -1): no browser outline.
  focusTarget: { outlineWidth: 0 } as object,
  block: { gap: space.md },
});
