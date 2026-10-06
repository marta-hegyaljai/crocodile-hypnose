import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { t } from '@/copy';
import { AuthScaffold } from '@/features/auth/AuthScaffold';
import { authCrocExpression, type FormPhase } from '@/features/auth/crocMood';
import { describeAuthError, type DescribedError } from '@/features/auth/describeError';
import { SharedAccountNote } from '@/features/auth/SharedAccountNote';
import { useFieldErrors } from '@/features/auth/useFieldErrors';
import { holdUntil } from '@/features/auth/holdUntil';
import { useSubmit } from '@/features/auth/useSubmit';
import { checkEmail, checkPassword } from '@/features/auth/validation';
import { useAuth } from '@/services/auth';
import { space } from '@/theme';
import { Button, Notice, Text, TextField } from '@/ui';

type Field = 'email' | 'password';

export default function SignInScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const signIn = useAuth((s) => s.signIn);
  const paramEmail = typeof params.email === 'string' ? params.email : '';
  const [email, setEmail] = useState(paramEmail);
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<Field | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [phase, setPhase] = useState<FormPhase>('idle');
  const [formError, setFormError] = useState<DescribedError | null>(null);
  const fields = useFieldErrors<Field>();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Coming back from "forgot password" or "sign in instead" with an email: use it
  // (adjusting state while rendering, as React recommends, instead of in an effect).
  const [seenParamEmail, setSeenParamEmail] = useState(paramEmail);
  if (paramEmail !== seenParamEmail) {
    setSeenParamEmail(paramEmail);
    if (paramEmail) setEmail(paramEmail);
  }

  const { run: submit, pending } = useSubmit(async () => {
    const startedAt = Date.now();
    const problems = { email: checkEmail(email), password: checkPassword(password, 'signIn') };
    fields.setProblems({
      ...(problems.email ? { email: problems.email } : {}),
      ...(problems.password ? { password: problems.password } : {}),
    });
    setFormError(null);
    if (problems.email || problems.password) {
      setPhase('error');
      (problems.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setPhase('submitting');
    try {
      await signIn({ email: email.trim(), password });
      setPhase('success');
    } catch (err) {
      // A fast failure (offline) still shows the spinner briefly, so Retry visibly does something.
      await holdUntil(startedAt);
      const described = describeAuthError(err);
      if (described.field === 'email' || described.field === 'password') {
        fields.setField(described.field, described);
      } else {
        setFormError(described);
      }
      setPhase('error');
    }
  });

  return (
    <AuthScaffold
      title={t('auth.signIn.title')}
      subtitle={t('auth.signIn.subtitle')}
      expression={authCrocExpression({ focused, passwordVisible, phase })}
      busy={pending}
      testID="sign-in-screen"
    >
      <View style={styles.fields}>
        <TextField
          ref={emailRef}
          label={t('auth.fields.email')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            fields.setField('email', null);
          }}
          onFocus={() => setFocused('email')}
          onBlur={() => {
            setFocused(null);
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
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          disabled={pending}
          testID="sign-in-email"
        />
        <TextField
          ref={passwordRef}
          label={t('auth.fields.password')}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            fields.setField('password', null);
          }}
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused(null)}
          secure
          onVisibilityChange={setPasswordVisible}
          error={fields.message('password')}
          autoComplete="current-password"
          textContentType="password"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          disabled={pending}
          testID="sign-in-password"
        />
        <Button
          label={t('auth.signIn.forgot')}
          variant="ghost"
          size="sm"
          style={styles.forgot}
          disabled={pending}
          onPress={() =>
            router.push({ pathname: '/forgot-password', params: email ? { email } : {} })
          }
          testID="sign-in-forgot"
        />
      </View>

      {formError ? (
        <Notice
          tone="error"
          message={t(formError.key, formError.params)}
          action={
            formError.retry
              ? { label: t('common.retry'), onPress: () => void submit(), testID: 'sign-in-retry' }
              : undefined
          }
          testID="sign-in-error"
        />
      ) : null}

      <Button
        label={t('auth.signIn.submit')}
        size="lg"
        fullWidth
        loading={pending}
        onPress={() => void submit()}
        testID="sign-in-submit"
      />
      <SharedAccountNote compact />
      <View style={styles.switch}>
        <Text variant="body" tone="secondary">
          {t('auth.signIn.noAccount')}
        </Text>
        <Button
          label={t('auth.signIn.createAccount')}
          variant="ghost"
          size="sm"
          disabled={pending}
          onPress={() => router.replace('/sign-up')}
          testID="sign-in-to-sign-up"
        />
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.lg },
  forgot: { alignSelf: 'flex-end', marginTop: -space.sm, marginRight: -space.md },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: space.xs,
  },
});
