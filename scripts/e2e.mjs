#!/usr/bin/env node
/**
 * End-to-end run: exports the web app into dist-e2e/ pointed at a throwaway account service,
 * verifies the bundle, then runs Playwright (which starts the API server and the static server).
 *
 *   npm run e2e [-- <playwright args>]      e.g. npm run e2e -- --project=phone-390
 *
 * Ports: E2E_PORT (web, default 4273) and E2E_API_PORT (API, default 4274), so several runs or a
 * QA server on 4173/4000 never collide.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const webPort = process.env.E2E_PORT ?? '4273';
const apiPort = process.env.E2E_API_PORT ?? '4274';
const apiUrl = `http://localhost:${apiPort}`;
const env = {
  ...process.env,
  E2E_PORT: webPort,
  E2E_API_PORT: apiPort,
  EXPO_PUBLIC_DEV_MODE: '1',
  EXPO_PUBLIC_API_URL: apiUrl,
};

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync('server/node_modules/fastify')) {
  console.log('e2e: installing the account service dependencies (server/)');
  run('npm', ['--prefix', 'server', 'ci', '--no-audit', '--no-fund']);
}
run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-e2e', '--clear']);
run('node', ['scripts/check-web-build.mjs', 'dist-e2e', 'dev', '--api', apiUrl]);
run('npx', ['playwright', 'test', ...process.argv.slice(2)]);
