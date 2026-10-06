import type { CrocExpression } from '@/illustration';

export type FormPhase = 'idle' | 'submitting' | 'error' | 'success';

export interface CrocMoodInput {
  /** The field that has focus, if any. */
  focused: 'email' | 'password' | 'name' | null;
  /** The password is shown in clear text. */
  passwordVisible: boolean;
  phase: FormPhase;
}

/**
 * How the croc reacts to the form: it closes its eyes while a hidden password is typed, peeks
 * happily when the password is shown, perks up while you type, stays calm on errors (never sad)
 * and celebrates on success.
 */
export function authCrocExpression({
  focused,
  passwordVisible,
  phase,
}: CrocMoodInput): CrocExpression {
  if (phase === 'success') return 'excited';
  if (focused === 'password') return passwordVisible ? 'happy' : 'eyesClosed';
  if (phase === 'submitting' || phase === 'error') return 'calm';
  if (focused) return 'happy';
  return 'calm';
}
