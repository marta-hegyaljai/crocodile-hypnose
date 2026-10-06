/**
 * Creates an account the way the MHP Coaching app would: a sign-up against the running account
 * service with client id `mhp-coaching`. Use it to test "sign up in Coaching, sign in to Hypnose".
 *
 *   npm run create-user -- --email ann@example.com --password "river walk" [--name Ann]
 *                          [--client mhp-coaching] [--api http://localhost:4000]
 */
import { parseArgs } from 'node:util';

import { CLIENT_IDS, isClientId } from '../src/clients.ts';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
    name: { type: 'string' },
    client: { type: 'string', default: 'mhp-coaching' },
    api: {
      type: 'string',
      default: process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
    },
    help: { type: 'boolean', short: 'h' },
  },
});

const usage =
  'usage: npm run create-user -- --email <email> --password <password> [--name <name>] ' +
  `[--client ${CLIENT_IDS.join('|')}] [--api <url>]`;

if (values.help || !values.email || !values.password) {
  console.error(usage);
  process.exit(values.help ? 0 : 2);
}
if (!isClientId(values.client)) {
  console.error(`unknown client "${values.client}"; use one of ${CLIENT_IDS.join(', ')}`);
  process.exit(2);
}

let res: Response;
try {
  res = await fetch(`${values.api}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: values.email,
      password: values.password,
      displayName: values.name ?? null,
      clientId: values.client,
    }),
  });
} catch (err) {
  console.error(`could not reach the account service at ${values.api}: ${(err as Error).message}`);
  console.error('start it with: npm run server (from the repo root)');
  process.exit(1);
}

const body = (await res.json()) as {
  user?: { id: string; email: string; displayName: string | null; signupClient: string };
  error?: { code: string; message: string };
};
if (!res.ok || !body.user) {
  console.error(`sign-up failed (${res.status}): ${body.error?.code} ${body.error?.message}`);
  process.exit(1);
}
const { user } = body;
console.log(
  `created ${user.email}${user.displayName ? ` (${user.displayName})` : ''} from ${user.signupClient}, id ${user.id}`,
);
