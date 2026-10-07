import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Chromium is preinstalled at /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH). Never run `playwright install`.
// `npm run e2e` (scripts/e2e.mjs) exports fresh into dist-e2e/ (never the shared dist/), pointed at
// the API port below, and then runs this config. Both servers get their own ports, so a stale or
// foreign server is never tested and nobody's running dist/ or dev API server is touched.
const PORT = Number(process.env.E2E_PORT ?? 4273);
const API_PORT = Number(process.env.E2E_API_PORT ?? 4274);
// A throwaway database per run, shared with the workers through the environment.
process.env.E2E_DB_PATH ??= join(tmpdir(), `mhp-e2e-${process.pid}-${Date.now()}.sqlite`);
process.env.E2E_API_URL = `http://localhost:${API_PORT}`;
// The API log, so tests can follow the password reset link the server "emails" (logs).
process.env.E2E_API_LOG ??= `${process.env.E2E_DB_PATH}.log`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // The dev account service on a fresh database. Rate limits are raised: every test signs in
      // from the same address.
      command: `node --disable-warning=ExperimentalWarning server/src/index.ts > "${process.env.E2E_API_LOG}" 2>&1`,
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PORT: String(API_PORT),
        DB_PATH: process.env.E2E_DB_PATH,
        CORS_ORIGINS: `http://localhost:${PORT},http://127.0.0.1:${PORT}`,
        AUTH_RATE_LIMIT_MAX: '1000',
        REFRESH_RATE_LIMIT_MAX: '1000',
        READ_RATE_LIMIT_MAX: '1000',
        RESET_LINK_BASE: `http://localhost:${PORT}/reset-password`,
        LOG_LEVEL: 'info',
        JWT_SECRET: 'e2e-only-secret-e2e-only-secret-e2e',
        // Dev-only shortcuts (e.g. adding calm minutes to see the croc grow).
        DEV_HOOKS: '1',
      },
    },
    {
      command: `npx serve dist-e2e --listen ${PORT} --single --no-clipboard --no-port-switching`,
      port: PORT,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: 'phone-390',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'phone-360',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 640 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-820',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 820, height: 1180 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
