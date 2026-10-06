import { ApiError, type ErrorCode } from './errors.ts';

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
/** Upper bound keeps hashing cheap to reject and blocks oversized inputs. */
export const PASSWORD_MAX = 128;
export const DISPLAY_NAME_MAX = 50;

// Deliberately simple: one @, something on each side, a dot in the domain, no whitespace.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/** Trims and lowercases; returns null when the result is not a plausible email address. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > EMAIL_MAX) return null;
  return EMAIL_RE.test(email) ? email : null;
}

export function isAcceptablePassword(password: string): boolean {
  const length = [...password].length;
  return length >= PASSWORD_MIN && length <= PASSWORD_MAX;
}

/** Trims; empty becomes null. Returns undefined when the name is not acceptable. */
export function normalizeDisplayName(raw: string | null | undefined): string | null | undefined {
  if (raw === null || raw === undefined) return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return null;
  if ([...name].length > DISPLAY_NAME_MAX || CONTROL_RE.test(name)) return undefined;
  return name;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string | null;
}

/** Validates sign-up input and reports every problem at once, per field. */
export function validateSignUp(body: {
  email: string;
  password: string;
  displayName?: string | null;
}): SignUpInput {
  const fields: Record<string, ErrorCode> = {};
  const email = normalizeEmail(body.email);
  if (!email) fields.email = 'invalid_email';
  if (!isAcceptablePassword(body.password)) fields.password = 'weak_password';
  const displayName = normalizeDisplayName(body.displayName);
  if (displayName === undefined) fields.displayName = 'invalid_display_name';

  const codes = Object.values(fields);
  if (codes.length > 0 || !email || displayName === undefined) {
    // A single problem gets its own top-level code; several get the generic one.
    const code: ErrorCode = codes.length === 1 && codes[0] ? codes[0] : 'invalid_request';
    throw new ApiError(400, code, messageFor(code), fields);
  }
  return { email, password: body.password, displayName };
}

function messageFor(code: ErrorCode): string {
  switch (code) {
    case 'invalid_email':
      return 'Enter a valid email address.';
    case 'weak_password':
      return `Use at least ${PASSWORD_MIN} characters (at most ${PASSWORD_MAX}).`;
    case 'invalid_display_name':
      return `Use at most ${DISPLAY_NAME_MAX} characters for the name.`;
    default:
      return 'Some fields need attention.';
  }
}
