/**
 * The apps that share one MHP user pool. Every auth request names the app it comes from,
 * so the service can record where a user signed up and when they last signed in to each app.
 */
export const CLIENT_IDS = ['mhp-coaching', 'mhp-hypnose'] as const;

export type ClientId = (typeof CLIENT_IDS)[number];

export function isClientId(value: unknown): value is ClientId {
  return typeof value === 'string' && (CLIENT_IDS as readonly string[]).includes(value);
}
