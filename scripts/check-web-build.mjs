#!/usr/bin/env node
/**
 * Verifies that a web export came out in the intended mode.
 *
 *   node scripts/check-web-build.mjs <output-dir> <dev|release> [--api <url>]
 *
 * `src/config/env.ts` leaves exactly one build marker in the bundle, depending on the inlined
 * EXPO_PUBLIC_DEV_MODE flag. Metro caches transforms without that flag, so an export can silently
 * come out in the previous mode; this check fails the build instead of shipping the wrong one.
 * With `--api`, it also checks that the bundle talks to that account service URL
 * (EXPO_PUBLIC_API_URL is inlined and cached the same way).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [, , dir, mode, ...rest] = process.argv;
const apiFlag = rest.indexOf('--api');
const expectedApi = apiFlag >= 0 ? rest[apiFlag + 1] : undefined;
if (!dir || (mode !== 'dev' && mode !== 'release') || (apiFlag >= 0 && !expectedApi)) {
  console.error('usage: check-web-build.mjs <output-dir> <dev|release> [--api <url>]');
  process.exit(2);
}

const ON = 'mhp-web-build:dev-mode-on';
const OFF = 'mhp-web-build:dev-mode-off';

function jsFiles(root) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.js')) out.push(p);
    }
  };
  walk(root);
  return out;
}

let files;
try {
  files = jsFiles(join(dir, '_expo'));
} catch {
  console.error(`check-web-build: no bundle found under ${dir}/_expo`);
  process.exit(1);
}
const source = files.map((f) => readFileSync(f, 'utf8')).join('\n');
const hasOn = source.includes(ON);
const hasOff = source.includes(OFF);

if (!hasOn && !hasOff) {
  console.error(`check-web-build: no build marker in ${dir}; is src/config/env.ts bundled?`);
  process.exit(1);
}
if (hasOn && hasOff) {
  console.error(
    `check-web-build: both markers present in ${dir}; the flag was not inlined as a literal.`,
  );
  process.exit(1);
}
const isDev = hasOn;
if ((mode === 'dev') !== isDev) {
  console.error(
    `check-web-build: ${dir} was built with dev mode ${isDev ? 'ON' : 'OFF'} but "${mode}" was requested. ` +
      'Re-run the export with --clear (Metro cached the previous flag value).',
  );
  process.exit(1);
}
if (expectedApi && !source.includes(JSON.stringify(expectedApi).slice(1, -1))) {
  console.error(
    `check-web-build: ${dir} does not point at ${expectedApi}. ` +
      'Re-run the export with --clear and EXPO_PUBLIC_API_URL set (Metro cached the previous value).',
  );
  process.exit(1);
}
console.log(
  `check-web-build: ${dir} OK (dev mode ${isDev ? 'on' : 'off'}${expectedApi ? `, API ${expectedApi}` : ''})`,
);
