import type { CopyKey } from '@/copy';
import { isAuthError, type AuthErrorCode } from '@/services/auth';

import { NAME_MAX, PASSWORD_MIN } from './validation';

export type AuthField = 'email' | 'password' | 'displayName';

export interface DescribedError {
  key: CopyKey;
  params?: Record<string, number>;
  /** Show the message on this field instead of above the form. */
  field?: AuthField;
  /** Worth offering a Retry button (nothing is wrong with the input). */
  retry: boolean;
}

const FIELD_CODES: Partial<Record<AuthErrorCode, { field: AuthField; key: CopyKey; n?: number }>> =
  {
    email_taken: { field: 'email', key: 'auth.errors.emailTaken' },
    invalid_email: { field: 'email', key: 'auth.validation.emailInvalid' },
    weak_password: { field: 'password', key: 'auth.validation.passwordShort', n: PASSWORD_MIN },
    invalid_display_name: { field: 'displayName', key: 'auth.validation.nameLong', n: NAME_MAX },
  };

/** Turns any error from the auth layer into copy for the form. */
export function describeAuthError(error: unknown): DescribedError {
  if (!isAuthError(error)) return { key: 'auth.errors.unknown', retry: true };
  const byField = FIELD_CODES[error.code];
  if (byField) {
    // Client-side checks catch the length rules first; this covers anything the server adds.
    return {
      key: byField.key,
      params: byField.n ? { n: byField.n } : undefined,
      field: byField.field,
      retry: false,
    };
  }
  switch (error.code) {
    case 'invalid_credentials':
      return { key: 'auth.errors.invalidCredentials', retry: false };
    case 'offline':
      return { key: 'auth.errors.offline', retry: true };
    case 'unreachable':
      return { key: 'auth.errors.unreachable', retry: true };
    case 'server_error':
      return { key: 'auth.errors.serverError', retry: true };
    case 'rate_limited':
      return { key: 'auth.errors.rateLimited', retry: false };
    case 'session_ended':
      return { key: 'auth.notices.sessionEnded', retry: false };
    default:
      return { key: 'auth.errors.unknown', retry: true };
  }
}
