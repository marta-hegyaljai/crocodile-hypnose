import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';

import { t } from '@/copy';
import { AuthScaffold } from '@/features/auth/AuthScaffold';
import { authCrocExpression, type FormPhase } from '@/features/auth/crocMood';
import { describeAuthError, type DescribedError } from '@/features/auth/describeError';
import { holdUntil } from '@/features/auth/holdUntil';
import { useFieldErrors } from '@/features/auth/useFieldErrors';
import { useSubmit } from '@/features/auth/useSubmit';
import { PASSWORD_MIN, checkPassword } from '@/features/auth/validation';
import { isAuthError, useAuth } from '@/services/auth';
import { Button, Notice, Text, TextField } from '@/ui';

/** Longer than any token the server issues (and than it accepts). */
const MAX_TOKEN_LENGTH = 512;

/**
 * Target of the emailed reset link (`/reset-password?token=…`). Reachable signed in or out: a
 * successful reset ends every session, and Welcome then says the password was changed.
 */
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const confirmReset = useAuth((s) => s.confirmPasswordReset);
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [phase, setPhase] = useState<FormPhase>('idle');
  const [formError, setFormError] = useState<DescribedError | null>(null);
  // Real tokens are 43 characters; a missing or mangled one is shown as an invalid link right away.
  const [linkInvalid, setLinkInvalid] = useState(!token || token.length > MAX_TOKEN_LENGTH);
  const fields = useFieldErrors<'password'>();
  const passwordRef = useRef<TextInput>(null);

  const { run: submit, pending } = useSubmit(async () => {
    const startedAt = Date.now();
    const problem = checkPassword(password, 'signUp');
    fields.setField('password', problem);
    setFormError(null);
    if (problem) {
      setPhase('error');
      passwordRef.current?.focus();
      return;
    }
    setPhase('submitting');
    try {
      await confirmReset(token, password);
      setPhase('success');
      router.replace('/welcome');
    } catch (err) {
      await holdUntil(startedAt);
      // Any problem with the token itself (unknown, used, expired, malformed) is an invalid link.
      if (isAuthError(err) && (err.code === 'invalid_reset_token' || err.fields.token)) {
        setLinkInvalid(true);
      } else {
        const described = describeAuthError(err);
        if (described.field === 'password') fields.setField('password', described);
        else setFormError(described);
      }
      setPhase('error');
    }
  });

  const requestNew = () => router.replace('/forgot-password');
  const goHome = () => router.replace('/home');

  return (
    // Keyed on the state, so the scaffold recomposes the scene when the form gives way to the notice.
    <AuthScaffold
      key={linkInvalid ? 'invalid' : 'form'}
      title={t('auth.reset.title')}
      expression={authCrocExpression({
        focused: focused ? 'password' : null,
        passwordVisible,
        phase,
      })}
      fallbackHref="/sign-in"
      busy={pending}
      testID="reset-screen"
    >
      {linkInvalid ? (
        <>
          <Notice tone="error" message={t('auth.reset.invalidLink')} testID="reset-invalid" />
          {signedIn ? (
            // "Forgot password" is for signed-out users: explain, and offer the way home instead.
            <>
              <Text variant="body" tone="secondary" testID="reset-signed-in-note">
                {t('auth.reset.signedInNote')}
              </Text>
              <Button
                label={t('auth.reset.goHome')}
                size="lg"
                fullWidth
                onPress={goHome}
                testID="reset-go-home"
              />
            </>
          ) : (
            <Button
              label={t('auth.reset.requestNew')}
              size="lg"
              fullWidth
              onPress={requestNew}
              testID="reset-request-new"
            />
          )}
        </>
      ) : (
        <>
          <Text variant="body" tone="secondary">
            {t('auth.reset.body')}
          </Text>
          <View>
            <TextField
              ref={passwordRef}
              label={t('auth.fields.newPassword')}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                fields.setField('password', null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                const problem = password ? checkPassword(password, 'signUp') : null;
                if (problem) fields.setField('password', problem);
              }}
              secure
              onVisibilityChange={setPasswordVisible}
              error={fields.message('password')}
              hint={t('auth.fields.passwordHint', { n: PASSWORD_MIN })}
              autoComplete="new-password"
              textContentType="newPassword"
              passwordRules={`minlength: ${PASSWORD_MIN};`}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              disabled={pending}
              testID="reset-password"
            />
          </View>
          {formError ? (
            <Notice
              tone="error"
              message={t(formError.key, formError.params)}
              action={
                formError.retry
                  ? {
                      label: t('common.retry'),
                      onPress: () => void submit(),
                      testID: 'reset-retry',
                    }
                  : undefined
              }
              testID="reset-error"
            />
          ) : null}
          <Button
            label={t('auth.reset.submit')}
            size="lg"
            fullWidth
            loading={pending}
            onPress={() => void submit()}
            testID="reset-submit"
          />
        </>
      )}
    </AuthScaffold>
  );
}
