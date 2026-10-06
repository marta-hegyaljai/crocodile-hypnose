import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, errors as joseErrors, jwtVerify } from 'jose';

import { isClientId, type ClientId } from './clients.ts';
import { errors } from './errors.ts';

export interface AccessClaims {
  userId: string;
  sessionId: string;
  clientId: ClientId;
}

export interface AccessTokenSigner {
  sign(claims: AccessClaims, now: number): Promise<{ token: string; expiresAt: number }>;
  verify(token: string, now: number): Promise<AccessClaims>;
}

/** Short-lived HS256 JWT access tokens: `sub` = user, `sid` = session, `aud` = client. */
export function createAccessTokenSigner(options: {
  secret: Uint8Array;
  issuer: string;
  ttlSeconds: number;
}): AccessTokenSigner {
  const { secret, issuer, ttlSeconds } = options;
  return {
    async sign(claims, now) {
      const iat = Math.floor(now / 1000);
      const exp = iat + ttlSeconds;
      const token = await new SignJWT({ sid: claims.sessionId })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(claims.userId)
        .setAudience(claims.clientId)
        .setIssuer(issuer)
        .setIssuedAt(iat)
        .setExpirationTime(exp)
        .setJti(randomBytes(9).toString('base64url'))
        .sign(secret);
      return { token, expiresAt: exp * 1000 };
    },
    async verify(token, now) {
      try {
        const { payload } = await jwtVerify(token, secret, {
          algorithms: ['HS256'],
          issuer,
          currentDate: new Date(now),
        });
        const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
        if (
          typeof payload.sub !== 'string' ||
          typeof payload.sid !== 'string' ||
          !isClientId(aud)
        ) {
          throw errors.unauthorized();
        }
        return { userId: payload.sub, sessionId: payload.sid, clientId: aud };
      } catch (err) {
        if (err instanceof joseErrors.JOSEError) throw errors.unauthorized();
        throw err;
      }
    },
  };
}

/** Opaque refresh tokens: 256 random bits. Only the SHA-256 hash is stored. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
