import { t } from '@/copy';
import { AuthError } from '@/services/auth';

import { authCrocExpression } from './crocMood';
import { describeAuthError } from './describeError';
import { checkEmail, checkName, checkPassword } from './validation';

describe('validation', () => {
  it('email', () => {
    expect(checkEmail('')?.key).toBe('auth.validation.emailRequired');
    expect(checkEmail('   ')?.key).toBe('auth.validation.emailRequired');
    expect(checkEmail('ann')?.key).toBe('auth.validation.emailInvalid');
    expect(checkEmail('ann@example')?.key).toBe('auth.validation.emailInvalid');
    expect(checkEmail(' Ann@Example.com ')).toBeNull();
  });

  it('password: sign-in only needs something, sign-up needs 8 to 128 characters', () => {
    expect(checkPassword('', 'signIn')?.key).toBe('auth.validation.passwordRequired');
    expect(checkPassword('x', 'signIn')).toBeNull();
    expect(checkPassword('1234567', 'signUp')).toEqual({
      key: 'auth.validation.passwordShort',
      params: { n: 8 },
    });
    expect(checkPassword('12345678', 'signUp')).toBeNull();
    expect(checkPassword('x'.repeat(129), 'signUp')?.key).toBe('auth.validation.passwordLong');
  });

  it('name is optional and capped', () => {
    expect(checkName('')).toBeNull();
    expect(checkName(`  ${'x'.repeat(50)}  `)).toBeNull();
    expect(checkName('x'.repeat(51))?.key).toBe('auth.validation.nameLong');
  });

  it('every message has copy', () => {
    for (const p of [
      checkEmail(''),
      checkEmail('a'),
      checkPassword('', 'signUp'),
      checkName('x'.repeat(60)),
    ]) {
      expect(t(p!.key, p!.params)).not.toContain('auth.');
    }
  });
});

describe('describeAuthError', () => {
  it('wrong password and unknown email read the same', () => {
    expect(describeAuthError(new AuthError('invalid_credentials'))).toEqual({
      key: 'auth.errors.invalidCredentials',
      retry: false,
    });
  });

  it('puts field problems on the field', () => {
    expect(describeAuthError(new AuthError('email_taken'))).toMatchObject({
      field: 'email',
      key: 'auth.errors.emailTaken',
    });
    expect(describeAuthError(new AuthError('weak_password'))).toMatchObject({ field: 'password' });
  });

  it('offers a retry for connectivity problems only', () => {
    expect(describeAuthError(new AuthError('offline'))).toEqual({
      key: 'auth.errors.offline',
      retry: true,
    });
    expect(describeAuthError(new AuthError('unreachable'))).toEqual({
      key: 'auth.errors.unreachable',
      retry: true,
    });
    expect(describeAuthError(new AuthError('server_error')).retry).toBe(true);
    expect(describeAuthError(new AuthError('rate_limited')).retry).toBe(false);
  });

  it('anything unexpected gets the generic message', () => {
    expect(describeAuthError(new Error('boom')).key).toBe('auth.errors.unknown');
    expect(describeAuthError(new AuthError('unknown')).key).toBe('auth.errors.unknown');
  });
});

describe('croc mood', () => {
  const base = { focused: null, passwordVisible: false, phase: 'idle' } as const;
  it('closes its eyes for a hidden password and peeks when it is shown', () => {
    expect(authCrocExpression({ ...base, focused: 'password' })).toBe('eyesClosed');
    expect(authCrocExpression({ ...base, focused: 'password', passwordVisible: true })).toBe(
      'happy',
    );
  });
  it('perks up while typing, stays calm on errors, celebrates success', () => {
    expect(authCrocExpression(base)).toBe('calm');
    expect(authCrocExpression({ ...base, focused: 'email' })).toBe('happy');
    expect(authCrocExpression({ ...base, phase: 'error' })).toBe('calm');
    expect(authCrocExpression({ ...base, phase: 'success', focused: 'password' })).toBe('excited');
  });
});
