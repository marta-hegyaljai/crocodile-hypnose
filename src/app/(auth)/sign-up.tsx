import { router } from 'expo-router';
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
import { PASSWORD_MIN, checkEmail, checkName, checkPassword } from '@/features/auth/validation';
import { useAuth } from '@/services/auth';
import { space } from '@/theme';
import { Button, Notice, Reveal, Text, TextField } from '@/ui';

type Field = 'displayName' | 'email' | 'password';

export default function SignUpScreen() {
  const signUp = useAuth((s) => s.signUp);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<'name' | 'email' | 'password' | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [phase, setPhase] = useState<FormPhase>('idle');
  const [formError, setFormError] = useState<DescribedError | null>(null);
  const fields = useFieldErrors<Field>();
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const emailTaken = fields.problems.email?.key === 'auth.errors.emailTaken';

  const { run: submit, pending } = useSubmit(async () => {
    const startedAt = Date.now();
    const problems = {
      displayName: checkName(name),
      email: checkEmail(email),
      password: checkPassword(password, 'signUp'),
    };
    const found = Object.fromEntries(Object.entries(problems).filter(([, p]) => p));
    fields.setProblems(found);
    setFormError(null);
    if (problems.displayName || problems.email || problems.password) {
      setPhase('error');
      (problems.displayName ? nameRef : problems.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setPhase('submitting');
    try {
      await signUp({ email: email.trim(), password, displayName: name.trim() || null });
      setPhase('success');
    } catch (err) {
      // A fast failure (offline) still shows the spinner briefly, so Retry visibly does something.
      await holdUntil(startedAt);
      const described = describeAuthError(err);
      if (described.field) {
        fields.setField(described.field, described);
        if (described.field === 'email') emailRef.current?.focus();
      } else {
        setFormError(described);
      }
      setPhase('error');
    }
  });

  return (
    <AuthScaffold
      title={t('auth.signUp.title')}
      expression={authCrocExpression({ focused, passwordVisible, phase })}
      busy={pending}
      testID="sign-up-screen"
    >
      <View style={styles.fields}>
        <TextField
          ref={nameRef}
          label={t('auth.fields.name')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            fields.setField('displayName', null);
          }}
          onFocus={() => setFocused('name')}
          onBlur={() => {
            setFocused(null);
            const problem = checkName(name);
            if (problem) fields.setField('displayName', problem);
          }}
          error={fields.message('displayName')}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          disabled={pending}
          testID="sign-up-name"
        />
        <View style={styles.emailBlock}>
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
            textContentType="emailAddress"
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            disabled={pending}
            testID="sign-up-email"
          />
          {emailTaken ? (
            <Reveal style={styles.instead} offset={4} delay={80}>
              <Button
                label={t('auth.signUp.signInInstead')}
                variant="secondary"
                size="sm"
                disabled={pending}
                onPress={() =>
                  router.replace({ pathname: '/sign-in', params: { email: email.trim() } })
                }
                testID="sign-up-sign-in-instead"
              />
            </Reveal>
          ) : null}
        </View>
        <TextField
          ref={passwordRef}
          label={t('auth.fields.newPassword')}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            fields.setField('password', null);
          }}
          onFocus={() => setFocused('password')}
          onBlur={() => {
            setFocused(null);
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
          testID="sign-up-password"
        />
      </View>

      {formError ? (
        <Notice
          tone="error"
          message={t(formError.key, formError.params)}
          action={
            formError.retry
              ? { label: t('common.retry'), onPress: () => void submit(), testID: 'sign-up-retry' }
              : undefined
          }
          testID="sign-up-error"
        />
      ) : null}

      <Button
        label={t('auth.signUp.submit')}
        size="lg"
        fullWidth
        loading={pending}
        onPress={() => void submit()}
        testID="sign-up-submit"
      />
      <SharedAccountNote compact />
      <View style={styles.switch}>
        <Text variant="body" tone="secondary">
          {t('auth.signUp.haveAccount')}
        </Text>
        <Button
          label={t('auth.signUp.signIn')}
          variant="ghost"
          size="sm"
          disabled={pending}
          onPress={() => router.replace('/sign-in')}
          testID="sign-up-to-sign-in"
        />
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.lg },
  emailBlock: { gap: space.sm },
  instead: { alignSelf: 'flex-start' },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: space.xs,
  },
});
