import type { CopyKey } from '@/copy';

/** Same limits as the account service; the server stays the authority. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 50;

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export interface FieldProblem {
  key: CopyKey;
  params?: Record<string, number>;
}

export function checkEmail(value: string): FieldProblem | null {
  const email = value.trim();
  if (!email) return { key: 'auth.validation.emailRequired' };
  if (email.length > 254 || !EMAIL_RE.test(email)) return { key: 'auth.validation.emailInvalid' };
  return null;
}

/** Sign-in only needs something typed; sign-up enforces the length rules. */
export function checkPassword(value: string, mode: 'signIn' | 'signUp'): FieldProblem | null {
  if (!value) return { key: 'auth.validation.passwordRequired' };
  if (mode === 'signIn') return null;
  const length = [...value].length;
  if (length < PASSWORD_MIN)
    return { key: 'auth.validation.passwordShort', params: { n: PASSWORD_MIN } };
  if (length > PASSWORD_MAX)
    return { key: 'auth.validation.passwordLong', params: { n: PASSWORD_MAX } };
  return null;
}

export function checkName(value: string): FieldProblem | null {
  if ([...value.trim()].length > NAME_MAX) {
    return { key: 'auth.validation.nameLong', params: { n: NAME_MAX } };
  }
  return null;
}
