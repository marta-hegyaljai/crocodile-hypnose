import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * scrypt password hashing with a per-user random salt. The parameters are stored with the hash,
 * so the cost can be raised later without breaking existing accounts.
 * Format: `scrypt$<log2 N>$<r>$<p>$<salt base64url>$<hash base64url>`.
 */
export interface ScryptParams {
  /** log2 of the CPU/memory cost N. 17 (N = 131072) follows the OWASP recommendation. */
  logN: number;
  r: number;
  p: number;
}

export const DEFAULT_SCRYPT: ScryptParams = { logN: 17, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const N = 2 ** params.logN;
  const options: ScryptOptions = {
    N,
    r: params.r,
    p: params.p,
    // scrypt needs about 128 * N * r bytes; leave headroom over Node's 32 MiB default.
    maxmem: 128 * N * params.r * 2,
  };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, params);
  return [
    'scrypt',
    params.logN,
    params.r,
    params.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, logN, r, p, salt, hash] = parts;
  const params = { logN: Number(logN), r: Number(r), p: Number(p) };
  if (![params.logN, params.r, params.p].every((n) => Number.isInteger(n) && n > 0)) return false;
  const expected = Buffer.from(hash ?? '', 'base64url');
  const actual = await derive(password, Buffer.from(salt ?? '', 'base64url'), params);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * A hash of a random password, used when the email is unknown so a failed sign-in takes as long
 * as a wrong password (no account enumeration through timing).
 */
export function createDummyHash(params: ScryptParams = DEFAULT_SCRYPT): Promise<string> {
  return hashPassword(randomBytes(18).toString('base64url'), params);
}
