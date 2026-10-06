import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { readFileSync } from 'node:fs';

// The throwaway account service started by playwright.config.ts.
const API = process.env.E2E_API_URL ?? 'http://localhost:4274';
const PASSWORD = 'river walk 1';

function uniqueEmail(info: TestInfo, tag: string): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `e2e-${tag}-${info.project.name}-${id}@example.com`;
}

/** Console errors, minus the browser's own log line for expected 4xx answers. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** Signs up in the UI. A new account lands in onboarding (step 3); see onboarding.spec.ts. */
async function signUpInUi(page: Page, email: string, name = 'E2E River') {
  await page.goto('/');
  await page.getByTestId('primary-cta').click();
  await page.getByTestId('welcome-sign-up').click();
  await page.getByTestId('sign-up-name').fill(name);
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill(PASSWORD);
  await page.getByTestId('sign-up-submit').click();
  await expect(page.getByTestId('onboarding-goals')).toBeVisible();
}

/** Marks onboarding finished through the API, as a device that completed it would have. */
async function finishOnboardingViaApi(request: APIRequestContext, email: string) {
  const signIn = await request.post(`${API}/auth/signin`, {
    data: { email, password: PASSWORD, clientId: 'mhp-hypnose' },
  });
  expect(signIn.status()).toBe(200);
  const { tokens } = (await signIn.json()) as { tokens: { accessToken: string } };
  const res = await request.put(`${API}/me/onboarding`, {
    headers: { authorization: `Bearer ${tokens.accessToken}` },
    data: {
      version: 1,
      updatedAt: Date.now() + 1000,
      step: 'done',
      completed: true,
      completedAt: Date.now(),
      goals: ['sleep'],
      experience: 'new',
      timeOfDay: 'evening',
      sessionLength: 'medium',
      safety: { answers: [false, false, false], acknowledged: false },
      moodConsent: false,
      crocHatched: true,
      crocName: 'Croc',
      firstSession: { completed: true, moodBefore: null, moodAfter: null },
      reminder: 'skipped',
      rewardGranted: true,
    },
  });
  expect(res.status()).toBe(200);
}

/** A signed-in user on home: UI sign-up, onboarding finished elsewhere, reload. */
async function signUpAndFinish(page: Page, request: APIRequestContext, email: string) {
  await signUpInUi(page, email);
  await finishOnboardingViaApi(request, email);
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
}

async function signInInUi(page: Page, email: string, password = PASSWORD) {
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill(password);
  await page.getByTestId('sign-in-password').press('Enter');
}

async function openSignIn(page: Page) {
  await page.goto('/welcome');
  await page.getByTestId('welcome-sign-in').click();
  await expect(page.getByTestId('sign-in-screen')).toBeVisible();
}

/** Every refresh the server refused in this context (a refused refresh signs the user out). */
function refusedRefreshes(context: BrowserContext): string[] {
  const refused: string[] = [];
  context.on('response', (res) => {
    if (res.url() === `${API}/auth/refresh` && res.status() !== 200) {
      refused.push(`${res.status()} ${res.url()}`);
    }
  });
  return refused;
}

/** The newest reset link the API logged for this email (the dev server logs instead of mailing). */
function resetLinkFor(email: string): string | null {
  const log = process.env.E2E_API_LOG;
  if (!log) return null;
  let link: string | null = null;
  for (const line of readFileSync(log, 'utf8').split('\n')) {
    if (!line.includes('resetLink')) continue;
    try {
      const entry = JSON.parse(line) as { email?: string; resetLink?: string };
      if (entry.email === email && entry.resetLink) link = entry.resetLink;
    } catch {
      // Not a log line.
    }
  }
  return link;
}

async function apiSignUp(
  request: APIRequestContext,
  email: string,
  clientId: string,
  name: string,
) {
  const res = await request.post(`${API}/auth/signup`, {
    data: { email, password: PASSWORD, displayName: name, clientId },
  });
  expect(res.status()).toBe(201);
}

test.describe('accounts', () => {
  test('sign up, reload, sign out, wrong password, sign in', async ({ page, request }, info) => {
    const errors = collectErrors(page);
    const email = uniqueEmail(info, 'flow');
    await signUpInUi(page, email);
    // A new account starts in onboarding; once that is done (here through the API), home.
    await finishOnboardingViaApi(request, email);

    // Reload keeps you signed in.
    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('home-greeting')).toHaveText('Hi, E2E River');
    await expect(page.getByTestId('home-email')).toContainText(email);

    await page.getByTestId('home-sign-out').click();
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    // Signed out stays signed out after a reload, and home is out of reach.
    await page.goto('/home');
    await expect(page.getByTestId('home-screen')).toHaveCount(0);

    await openSignIn(page);
    await signInInUi(page, email, 'not the password');
    await expect(page.getByTestId('sign-in-error-message')).toHaveText(
      'Email or password is incorrect.',
    );
    await signInInUi(page, ` ${email.toUpperCase()} `);
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('home-celebrate')).toHaveCount(0);
    // Signed in: the account screens are out of reach.
    await page.goto('/sign-in');
    await expect(page.getByTestId('home-screen')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('an unknown email gets the same message as a wrong password', async ({ page }, info) => {
    await openSignIn(page);
    await signInInUi(page, uniqueEmail(info, 'nobody'));
    await expect(page.getByTestId('sign-in-error-message')).toHaveText(
      'Email or password is incorrect.',
    );
  });

  test('an account created in the Coaching app signs in here', async ({ page, request }, info) => {
    const email = uniqueEmail(info, 'coach');
    await apiSignUp(request, email, 'mhp-coaching', 'Coach Ann');
    await finishOnboardingViaApi(request, email);
    await openSignIn(page);
    await signInInUi(page, email);
    await expect(page.getByTestId('home-greeting')).toHaveText('Hi, Coach Ann');

    // The account service now knows both apps for this user.
    const signIn = await request.post(`${API}/auth/signin`, {
      data: { email, password: PASSWORD, clientId: 'mhp-coaching' },
    });
    const { user } = await signIn.json();
    expect(user.signupClient).toBe('mhp-coaching');
    expect(user.clients.map((c: { clientId: string }) => c.clientId).sort()).toEqual([
      'mhp-coaching',
      'mhp-hypnose',
    ]);
  });

  test('sign-up validates inline and reports a taken email', async ({ page, request }, info) => {
    const email = uniqueEmail(info, 'taken');
    await apiSignUp(request, email, 'mhp-coaching', 'Taken');
    await page.goto('/sign-up');
    await page.getByTestId('sign-up-submit').click();
    await expect(page.getByTestId('sign-up-email-error')).toHaveText('Enter your email address.');
    await page.getByTestId('sign-up-email').fill(email);
    await page.getByTestId('sign-up-password').fill('short');
    await page.getByTestId('sign-up-submit').click();
    await expect(page.getByTestId('sign-up-password-error')).toHaveText(
      'Use at least 8 characters.',
    );
    await page.getByTestId('sign-up-password').fill(PASSWORD);
    await page.getByTestId('sign-up-submit').click();
    await expect(page.getByTestId('sign-up-email-error')).toHaveText(
      'An account with this email already exists.',
    );
    await page.getByTestId('sign-up-sign-in-instead').click();
    await expect(page.getByTestId('sign-in-email')).toHaveValue(email);
  });

  test('offline and server-down are explained, and Retry recovers', async ({
    page,
    context,
    request,
  }, info) => {
    const email = uniqueEmail(info, 'net');
    await apiSignUp(request, email, 'mhp-hypnose', 'Net');
    await finishOnboardingViaApi(request, email);
    await openSignIn(page);

    await context.setOffline(true);
    await signInInUi(page, email);
    await expect(page.getByTestId('sign-in-error-message')).toContainText('You are offline.');
    await context.setOffline(false);

    // Server down: every API request is refused.
    await page.route(`${API}/**`, (route) => route.abort('connectionrefused'));
    await page.getByTestId('sign-in-retry').click();
    await expect(page.getByTestId('sign-in-error-message')).toContainText(
      'The server cannot be reached',
    );
    await page.unroute(`${API}/**`);
    await page.getByTestId('sign-in-retry').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });

  test('a refused access token refreshes silently', async ({ page, request }, info) => {
    await signUpAndFinish(page, request, uniqueEmail(info, 'refresh'));
    // The next profile call is answered 401, as for an expired token.
    let refused = false;
    await page.route(`${API}/me`, async (route) => {
      if (!refused && route.request().method() === 'GET') {
        refused = true;
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'unauthorized', message: 'expired' } }),
        });
      }
      return route.continue();
    });
    const refreshed = page.waitForResponse(
      (res) => res.url() === `${API}/auth/refresh` && res.status() === 200,
    );
    const retried = page.waitForResponse(
      (res) => res.url() === `${API}/me` && res.status() === 200,
    );
    await page.reload();
    await refreshed;
    await retried;
    expect(refused).toBe(true);
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });

  test('a session revoked elsewhere signs out cleanly', async ({ page, request }, info) => {
    await signUpAndFinish(page, request, uniqueEmail(info, 'revoked'));
    const refreshToken = await page.evaluate(() => {
      const raw = window.localStorage.getItem('mhp.hypnose.session.v1');
      return raw ? (JSON.parse(raw) as { refreshToken: string }).refreshToken : null;
    });
    expect(refreshToken).toBeTruthy();
    const res = await request.post(`${API}/auth/signout`, { data: { refreshToken } });
    expect(res.status()).toBe(204);
    await page.reload();
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    await expect(page.getByTestId('welcome-notice-message')).toHaveText(
      'You were signed out. Sign in again to continue.',
    );
    expect(
      await page.evaluate(() => window.localStorage.getItem('mhp.hypnose.session.v1')),
    ).toBeNull();
  });

  test('deleting the account removes it; signing in afterwards fails', async ({
    page,
    request,
  }, info) => {
    const email = uniqueEmail(info, 'delete');
    await signUpAndFinish(page, request, email);
    await page.getByTestId('home-delete-account').click();
    await expect(page.getByTestId('delete-confirm')).toBeVisible();
    await page.getByTestId('delete-cancel').click();
    await expect(page.getByTestId('home-sign-out')).toBeVisible();
    await page.getByTestId('home-delete-account').click();
    await page.getByTestId('delete-confirm-button').click();
    await expect(page.getByTestId('welcome-notice-message')).toHaveText(
      'Your account was deleted.',
    );

    await page.getByTestId('welcome-sign-in').click();
    await signInInUi(page, email);
    await expect(page.getByTestId('sign-in-error-message')).toHaveText(
      'Email or password is incorrect.',
    );
  });

  test('forgot password confirms without revealing the account', async ({ page }, info) => {
    await openSignIn(page);
    const email = uniqueEmail(info, 'forgot');
    await page.getByTestId('sign-in-email').fill(email);
    await page.getByTestId('sign-in-forgot').click();
    await expect(page.getByTestId('forgot-email')).toHaveValue(email);
    await page.getByTestId('forgot-submit').click();
    await expect(page.getByTestId('forgot-sent-message')).toContainText(email);
    await page.getByTestId('forgot-back-to-sign-in').click();
    await expect(page.getByTestId('sign-in-screen')).toBeVisible();
    await expect(page.getByTestId('sign-in-email')).toHaveValue(email);
  });

  test('account screens fit the phone and keep 44px targets', async ({ page }) => {
    for (const path of ['/welcome', '/sign-in', '/sign-up', '/forgot-password']) {
      await page.goto(path);
      await expect(page.locator('[data-testid$="-screen"]').first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, path).toBe(false);
      for (const button of await page.getByRole('button').all()) {
        if (!(await button.isVisible())) continue;
        const box = await button.boundingBox();
        expect(
          box!.height,
          `${path} ${await button.getAttribute('aria-label')}`,
        ).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('two tabs: a stale tab adopts the rotated token and its action goes through', async ({
    page,
    context,
    request,
  }, info) => {
    const refused = refusedRefreshes(context);
    // Tab A misses the storage event, so it has to re-read storage before it refreshes.
    await page.addInitScript(() => {
      const add = window.addEventListener.bind(window);
      window.addEventListener = ((type: string, ...rest: unknown[]) => {
        if (type === 'storage') return;
        return (add as (...args: unknown[]) => void)(type, ...rest);
      }) as typeof window.addEventListener;
    });
    await signUpAndFinish(page, request, uniqueEmail(info, 'tabs'));
    const tabB = await context.newPage();
    await tabB.goto('/home');
    await expect(tabB.getByTestId('home-screen')).toBeVisible();
    await tabB.reload();
    await expect(tabB.getByTestId('home-screen')).toBeVisible();

    // A's access token is refused once (as when it expired), so A refreshes with what it holds.
    let forced = false;
    await page.route(`${API}/me`, async (route) => {
      if (!forced && route.request().method() === 'DELETE') {
        forced = true;
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'unauthorized', message: 'expired' } }),
        });
      }
      return route.continue();
    });
    await page.getByTestId('home-delete-account').click();
    await page.getByTestId('delete-confirm-button').click();
    await expect(page.getByTestId('welcome-notice-message')).toHaveText(
      'Your account was deleted.',
    );
    expect(forced).toBe(true);
    expect(refused).toEqual([]);
  });

  test('tabs opened at the same time share one session', async ({
    page,
    context,
    request,
  }, info) => {
    const refused = refusedRefreshes(context);
    await signUpAndFinish(page, request, uniqueEmail(info, 'together'));
    const tabs = [await context.newPage(), await context.newPage(), await context.newPage()];
    await Promise.all(tabs.map((tab) => tab.goto('/home')));
    for (const tab of tabs) await expect(tab.getByTestId('home-screen')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    expect(refused).toEqual([]);

    // Signing out in one tab signs out the others.
    await tabs[0]!.getByTestId('home-sign-out').click();
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    await expect(tabs[1]!.getByTestId('welcome-screen')).toBeVisible();
  });

  test('a reload while a refresh is in flight keeps you signed in', async ({
    page,
    context,
    request,
  }, info) => {
    const refused = refusedRefreshes(context);
    await signUpAndFinish(page, request, uniqueEmail(info, 'slow'));
    // The server rotates the token, but the answer is held back and then lost to a reload.
    let held = false;
    await page.route(
      `${API}/auth/refresh`,
      async (route) => {
        const response = await route.fetch();
        held = true;
        await new Promise((r) => setTimeout(r, 2500));
        await route.fulfill({ response }).catch(() => undefined);
      },
      { times: 1 },
    );
    await page.reload();
    await expect.poll(() => held).toBe(true);
    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('home-screen')).toBeVisible();
    expect(refused).toEqual([]);
  });

  test('double-tapping Sign out lands on Welcome', async ({ page, request }, info) => {
    await signUpAndFinish(page, request, uniqueEmail(info, 'dbl'));
    await page.getByTestId('home-sign-out').dblclick();
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('sign-in-screen')).toHaveCount(0);
  });

  test('keyboard focus moves into the delete confirmation and back', async ({
    page,
    request,
  }, info) => {
    await signUpAndFinish(page, request, uniqueEmail(info, 'focus'));
    const active = () => page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    await page.getByTestId('home-delete-account').focus();
    await page.keyboard.press('Enter');
    await expect.poll(active).toBe('delete-confirm-title');
    await page.keyboard.press('Tab');
    await expect.poll(active).toBe('delete-cancel');
    await page.keyboard.press('Enter');
    await expect.poll(active).toBe('home-delete-account');
  });

  test('password reset from the emailed link', async ({ page, request }, info) => {
    const email = uniqueEmail(info, 'reset');
    await apiSignUp(request, email, 'mhp-coaching', 'Reset');
    await finishOnboardingViaApi(request, email);
    await page.goto('/forgot-password');
    await page.getByTestId('forgot-email').fill(email);
    await page.getByTestId('forgot-submit').click();
    await expect(page.getByTestId('forgot-sent')).toBeVisible();
    await expect.poll(() => resetLinkFor(email)).toBeTruthy();
    const link = resetLinkFor(email)!;

    await page.goto(link);
    await page.getByTestId('reset-password').fill('a new river 1');
    await page.getByTestId('reset-submit').click();
    await expect(page.getByTestId('welcome-notice-message')).toHaveText(
      'Your password was changed. Sign in with your new password.',
    );
    await page.getByTestId('welcome-sign-in').click();
    await signInInUi(page, email);
    await expect(page.getByTestId('sign-in-error-message')).toHaveText(
      'Email or password is incorrect.',
    );
    await signInInUi(page, email, 'a new river 1');
    await expect(page.getByTestId('home-screen')).toBeVisible();

    // The link works once.
    await page.getByTestId('home-sign-out').click();
    await page.goto(link);
    await page.getByTestId('reset-password').fill('another one 1');
    await page.getByTestId('reset-submit').click();
    await expect(page.getByTestId('reset-invalid')).toBeVisible();
  });
});
