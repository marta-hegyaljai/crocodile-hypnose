import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type Text as RNText } from 'react-native';

import { t, type CopyKey } from '@/copy';
import { describeAuthError } from '@/features/auth/describeError';
import { holdUntil } from '@/features/auth/holdUntil';
import { useSubmit } from '@/features/auth/useSubmit';
import { useAuth } from '@/services/auth';
import { isAuthError } from '@/services/auth/types';
import { space } from '@/theme';
import { Button, Notice, Reveal, Text, TextField, moveFocus, useDialog } from '@/ui';

/**
 * Delete account, behind an in-page confirmation and the password (recent authentication). The
 * parent keys this component on the user id, so a confirmation left open never carries over to
 * another account (a tab that switched user).
 */
export function DeleteAccount() {
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<{ key: CopyKey; params?: Record<string, number> } | null>(
    null,
  );
  const titleRef = useRef<View>(null);
  const titleTextRef = useRef<RNText>(null);
  const openRef = useRef<View>(null);
  const opened = useRef(false);

  // Focus follows the confirmation: into its title when it opens, back to the button on cancel.
  useEffect(() => {
    if (confirming) {
      opened.current = true;
      moveFocus(titleRef.current ?? titleTextRef.current);
    } else if (opened.current) {
      opened.current = false;
      moveFocus(openRef.current);
    }
  }, [confirming]);

  const deleting = useSubmit(async () => {
    if (password === '') {
      setProblem({ key: 'account.deletePasswordRequired' });
      return;
    }
    const startedAt = Date.now();
    setProblem(null);
    try {
      await deleteAccount(password);
    } catch (err) {
      await holdUntil(startedAt);
      setProblem(
        isAuthError(err) && err.code === 'invalid_credentials'
          ? { key: 'account.deleteWrongPassword' }
          : describeAuthError(err),
      );
    }
  });

  const close = () => {
    setConfirming(false);
    setPassword('');
    setProblem(null);
  };
  // Escape backs out of the confirmation (never while the deletion is in flight).
  const { ref: dialogRef, props: dialogProps } = useDialog({
    onClose: confirming && !deleting.pending ? close : undefined,
    autoFocus: false,
  });

  if (!confirming) {
    return (
      <Button
        ref={openRef}
        label={t('account.delete')}
        variant="ghost"
        fullWidth
        onPress={() => setConfirming(true)}
        testID="profile-delete-account"
      />
    );
  }

  const fieldProblem = problem?.key === 'account.deletePasswordRequired';
  return (
    <View ref={dialogRef} {...dialogProps} style={styles.focusTarget}>
      <Reveal style={styles.block} testID="delete-confirm">
        <View ref={titleRef} tabIndex={-1} style={styles.focusTarget} testID="delete-confirm-title">
          <Text variant="heading" heading={3} ref={titleTextRef}>
            {t('account.deleteTitle')}
          </Text>
        </View>
        <Text variant="body" tone="secondary">
          {t('account.deleteBody')}
        </Text>
        <TextField
          label={t('account.deletePasswordLabel')}
          hint={t('account.deletePasswordHint')}
          secure
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (problem) setProblem(null);
          }}
          error={fieldProblem ? t('account.deletePasswordRequired') : null}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={() => void deleting.run()}
          disabled={deleting.pending}
          testID="delete-password"
        />
        {problem && !fieldProblem ? (
          <Notice tone="error" message={t(problem.key, problem.params)} testID="delete-error" />
        ) : null}
        {/* The safe choice comes first in reading and tab order. */}
        <Button
          label={t('account.deleteCancel')}
          variant="secondary"
          size="lg"
          fullWidth
          disabled={deleting.pending}
          onPress={close}
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
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  // Programmatic focus target only (tabIndex -1): no browser outline.
  focusTarget: { outlineWidth: 0 } as object,
});
