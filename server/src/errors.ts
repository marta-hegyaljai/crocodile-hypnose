/**
 * Machine-readable error codes. Every error response has the shape
 * `{ "error": { "code": ErrorCode, "message": string, "fields"?: { [field]: ErrorCode } } }`.
 */
export type ErrorCode =
  | 'invalid_request'
  | 'invalid_email'
  | 'weak_password'
  | 'invalid_display_name'
  | 'unknown_client'
  | 'email_taken'
  | 'invalid_credentials'
  | 'unauthorized'
  | 'invalid_refresh_token'
  | 'refresh_token_reused'
  | 'invalid_reset_token'
  | 'rate_limited'
  | 'not_found'
  | 'consent_required'
  | 'internal';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; fields?: Record<string, ErrorCode> };
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly fields: Record<string, ErrorCode> | undefined;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    fields?: Record<string, ErrorCode>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}

export const errors = {
  invalidCredentials: () =>
    new ApiError(401, 'invalid_credentials', 'Email or password is incorrect.'),
  unauthorized: () => new ApiError(401, 'unauthorized', 'Sign in again to continue.'),
  invalidRefreshToken: () =>
    new ApiError(401, 'invalid_refresh_token', 'The session has ended. Sign in again.'),
  refreshTokenReused: () =>
    new ApiError(401, 'refresh_token_reused', 'The session has ended. Sign in again.'),
  invalidResetToken: () =>
    new ApiError(
      400,
      'invalid_reset_token',
      'This reset link is not valid any more. Request a new one.',
    ),
  emailTaken: () =>
    new ApiError(409, 'email_taken', 'An account with this email already exists.', {
      email: 'email_taken',
    }),
  unknownClient: () =>
    new ApiError(400, 'unknown_client', 'Unknown client.', { clientId: 'unknown_client' }),
};
