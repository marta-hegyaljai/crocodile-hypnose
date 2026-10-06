import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';

import { t } from '@/copy';
import { AuthScaffold } from '@/features/auth/AuthScaffold';
import { authCrocExpression, type FormPhase } from '@/features/auth/crocMood';
import { describeAuthError, type DescribedError } from '@/features/auth/describeError';
import { useFieldErrors } from '@/features/auth/useFieldErrors';
import { holdUntil } from '@/features/auth/holdUntil';
import { useSubmit } from '@/features/auth/useSubmit';
import { checkEmail } from '@/features/auth/validation';
import { useAuth } from '@/services/auth';
import { Button, Notice, Text, TextField } from '@/ui';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const requestReset = useAuth((s) => s.requestPasswordReset);
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState<FormPhase>('idle');
  const [formError, setFormError] = useState<DescribedError | null>(null);
  const fields = useFieldErrors<'email'>();
  const emailRef = useRef<TextInput>(null);

  const { run: submit, pending } = useSubmit(async () => {
    const startedAt = Date.now();
    const problem = checkEmail(email);
    fields.setField('email', problem);
    setFormError(null);
    if (problem) {
      setPhase('error');
      emailRef.current?.focus();
      return;
    }
    setPhase('submitting');
    try {
      await requestReset(email.trim());
      setSentTo(email.trim());
      setPhase('success');
    } catch (err) {
      // A fast failure (offline) still shows the spinner briefly, so Retry visibly does something.
      await holdUntil(startedAt);
      setFormError(describeAuthError(err));
      setPhase('error');
    }
  });

  const backToSignIn = () =>
    router.dismissTo({ pathname: '/sign-in', params: email.trim() ? { email: email.trim() } : {} });

  if (sentTo) {
    return (
      // Its own instance: the scaffold composes the scene around this shorter content.
      <AuthScaffold
        key="sent"
        title={t('auth.forgot.sentTitle')}
        expression="happy"
        fallbackHref="/sign-in"
        testID="forgot-sent-screen"
      >
        <Notice
          tone="success"
          message={t('auth.forgot.sentBody', { email: sentTo })}
          testID="forgot-sent"
        />
        <Button
          label={t('auth.forgot.backToSignIn')}
          size="lg"
          fullWidth
          onPress={backToSignIn}
          testID="forgot-back-to-sign-in"
        />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title={t('auth.forgot.title')}
      expression={authCrocExpression({
        focused: focused ? 'email' : null,
        passwordVisible: false,
        phase,
      })}
      fallbackHref="/sign-in"
      busy={pending}
      testID="forgot-screen"
    >
      <Text variant="body" tone="secondary">
        {t('auth.forgot.body')}
      </Text>
      <View>
        <TextField
          ref={emailRef}
          label={t('auth.fields.email')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            fields.setField('email', null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            // Only add a problem on blur; a server message (e.g. email taken) stays until edited.
            const problem = email ? checkEmail(email) : null;
            if (problem) fields.setField('email', problem);
          }}
          error={fields.message('email')}
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
          disabled={pending}
          testID="forgot-email"
        />
      </View>
      {formError ? (
        <Notice
          tone="error"
          message={t(formError.key, formError.params)}
          action={
            formError.retry
              ? { label: t('common.retry'), onPress: () => void submit(), testID: 'forgot-retry' }
              : undefined
          }
          testID="forgot-error"
        />
      ) : null}
      <Button
        label={t('auth.forgot.submit')}
        size="lg"
        fullWidth
        loading={pending}
        onPress={() => void submit()}
        testID="forgot-submit"
      />
      <Button
        label={t('auth.forgot.backToSignIn')}
        variant="ghost"
        size="sm"
        disabled={pending}
        onPress={backToSignIn}
        testID="forgot-to-sign-in"
      />
    </AuthScaffold>
  );
}
