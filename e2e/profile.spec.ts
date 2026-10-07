import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// The throwaway account service started by playwright.config.ts.
const API = process.env.E2E_API_URL ?? 'http://localhost:4274';
const PASSWORD = 'river walk 1';

function uniqueEmail(info: TestInfo, tag: string): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `e2e-profile-${tag}-${info.project.name}-${id}@example.com`;
}

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

type Headers = { authorization: string };

async function apiHeaders(request: APIRequestContext, email: string): Promise<Headers> {
  const res = await request.post(`${API}/auth/signin`, {
    data: { email, password: PASSWORD, clientId: 'mhp-hypnose' },
  });
  const token = ((await res.json()) as { tokens: { accessToken: string } }).tokens.accessToken;
  return { authorization: `Bearer ${token}` };
}

/**
 * A user who finished onboarding with the first five Intro stops done, signed in and looking at
 * home. `moods` seeds that many mood check-ins on the server (with consent).
 */
async function onHome(
  page: Page,
  request: APIRequestContext,
  email: string,
  { moods = 0 }: { moods?: number } = {},
): Promise<Headers> {
  await page.goto('/sign-up');
  await page.getByTestId('sign-up-name').fill('E2E Profile');
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill(PASSWORD);
  await page.getByTestId('sign-up-submit').click();
  await expect(page.getByTestId('onboarding-goals')).toBeVisible();
  const headers = await apiHeaders(request, email);
  const now = Date.now();
  const put = async (kind: string, data: object) => {
    const res = await request.put(`${API}/me/${kind}`, { headers, data });
    expect(res.status()).toBe(200);
  };
  const consent = moods > 0;
  await put('onboarding', {
    version: 1,
    updatedAt: now + 1000,
    step: 'done',
    completed: true,
    completedAt: now,
    goals: [],
    experience: 'new',
    timeOfDay: 'evening',
    sessionLength: 'medium',
    safety: { answers: [false, false, false], acknowledged: false },
    moodConsent: consent,
    crocHatched: true,
    crocName: 'Zé',
    firstSession: { completed: true, moodBefore: consent ? 2 : null, moodAfter: null },
    reminder: 'skipped',
    rewardGranted: true,
  });
  await put('settings', {
    version: 1,
    updatedAt: now + 1000,
    crocName: 'Zé',
    goals: [],
    experience: 'new',
    sessionLength: 'medium',
    reminder: { enabled: false, time: null, timeOfDay: 'evening' },
    moodConsent: consent,
    safety: { answers: [false, false, false], cautionMode: false },
    sound: true,
    haptics: true,
  });
  await put('progress', {
    version: 1,
    updatedAt: now,
    stops: Object.fromEntries(
      ['intro-1', 'intro-2', 'intro-3', 'intro-4', 'intro-5'].map((id) => [
        id,
        { status: 'done', updatedAt: now - 1000, completedAt: now - 1000 },
      ]),
    ),
  });
  if (moods > 0) {
    const entries = Array.from({ length: moods }, (_, i) => ({
      id: `mood-e2e-${i}-${now}`,
      at: now - 5000 - i,
      phase: i % 2 ? 'after' : 'before',
      value: 3,
      stopId: 'intro-2',
    }));
    const res = await request.post(`${API}/me/mood`, { headers, data: { entries } });
    expect(res.status()).toBe(200);
  }
  // The local copies are the fresh account's; drop them so the server's load.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('mhp.hypnose.') && !key.startsWith('mhp.hypnose.session')) {
        localStorage.removeItem(key);
      }
    }
  });
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  return headers;
}

async function openProfile(page: Page) {
  await page.getByTestId('tab-profile').click();
  await expect(page.getByTestId('profile-screen')).toBeVisible();
}

async function serverSettings(request: APIRequestContext, headers: Headers) {
  const res = await request.get(`${API}/me/settings`, { headers });
  return ((await res.json()) as { settings: Record<string, unknown> }).settings;
}

test.describe('profile and settings', () => {
  test('shows the croc, the account and a summary; renames the croc', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    const email = uniqueEmail(info, 'summary');
    const headers = await onHome(page, request, email);
    await openProfile(page);
    await expect(page.getByTestId('profile-croc-name')).toHaveText('Zé');
    await expect(page.getByTestId('profile-email')).toContainText(email);
    await expect(page.getByTestId('profile-summary')).toBeVisible();
    await expect(page.getByTestId('profile-stat-sessions')).toHaveText('0');

    // Too long: the limit is named, not a template placeholder.
    await page.getByTestId('profile-name').fill('R'.repeat(21));
    await page.getByTestId('profile-name-save').click();
    await expect(page.getByTestId('profile-name-error')).toHaveText('Use at most 20 characters.');

    await page.getByTestId('profile-name').fill('  Rio  ');
    await page.getByTestId('profile-name-save').click();
    await expect(page.getByTestId('profile-name-saved')).toBeVisible();
    await expect(page.getByTestId('profile-croc-name')).toHaveText('Rio');
    await expect.poll(async () => (await serverSettings(request, headers)).crocName).toBe('Rio');
    // Home shows it too.
    await page.getByTestId('tab-home').click();
    await expect(page.getByTestId('home-croc-name')).toHaveText('Rio');
    expect(errors).toEqual([]);
  });

  test('reminder time and toggles persist across a reload and on another device', async ({
    page,
    request,
    browser,
  }, info) => {
    const errors = collectErrors(page);
    const email = uniqueEmail(info, 'reminder');
    const headers = await onHome(page, request, email);
    await openProfile(page);

    await page.getByTestId('setting-reminder').click();
    await expect(page.getByTestId('reminder-time')).toHaveValue('20:30');
    await page.getByTestId('reminder-time').fill('07:15');
    await page.getByTestId('setting-sound').click();
    await page.getByTestId('setting-motion-reduce').click();
    await page.getByTestId('setting-length-long').click();
    await expect
      .poll(async () => (await serverSettings(request, headers)).reminder)
      .toEqual({
        enabled: true,
        time: '07:15',
        timeOfDay: 'morning',
      });
    expect(await serverSettings(request, headers)).toMatchObject({
      sound: false,
      reducedMotion: true,
      sessionLength: 'long',
    });

    await page.reload();
    await expect(page.getByTestId('profile-screen')).toBeVisible();
    await expect(page.getByTestId('reminder-time')).toHaveValue('07:15');
    await expect(page.getByTestId('setting-sound')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('setting-motion-reduce')).toHaveAttribute('aria-checked', 'true');

    // Another device: sign in fresh and see the same settings.
    const other = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    const tab = await other.newPage();
    await tab.goto('/sign-in');
    await tab.getByTestId('sign-in-email').fill(email);
    await tab.getByTestId('sign-in-password').fill(PASSWORD);
    await tab.getByTestId('sign-in-password').press('Enter');
    await expect(tab.getByTestId('home-screen')).toBeVisible();
    await openProfile(tab);
    await expect(tab.getByTestId('reminder-time')).toHaveValue('07:15');
    await expect(tab.getByTestId('setting-length-long')).toHaveAttribute('aria-checked', 'true');
    await other.close();

    // An invalid time is refused and nothing changes.
    await page.getByTestId('reminder-time').fill('7:1');
    await expect(page.getByTestId('reminder-time-error')).toBeVisible();
    expect(((await serverSettings(request, headers)).reminder as { time: string }).time).toBe(
      '07:15',
    );
    expect(errors).toEqual([]);
  });

  test('turning mood check-ins off deletes the entries on the server', async ({
    page,
    request,
  }, info) => {
    const email = uniqueEmail(info, 'mood');
    const headers = await onHome(page, request, email, { moods: 3 });
    const list = async () =>
      (
        (await (await request.get(`${API}/me/mood`, { headers })).json()) as {
          entries: unknown[];
        }
      ).entries;
    expect(await list()).toHaveLength(3);

    await openProfile(page);
    await expect(page.getByTestId('setting-mood')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('setting-mood').click();
    await expect(page.getByTestId('mood-deleted')).toBeVisible();
    await expect.poll(list).toHaveLength(0);
    expect((await serverSettings(request, headers)).moodConsent).toBe(false);
    const onboarding = (await (await request.get(`${API}/me/onboarding`, { headers })).json()) as {
      onboarding: { firstSession: { moodBefore: number | null } };
    };
    expect(onboarding.onboarding.firstSession.moodBefore).toBeNull();

    // Stays off after a reload, and no entry comes back.
    await page.reload();
    await openProfile(page);
    await expect(page.getByTestId('setting-mood')).toHaveAttribute('aria-checked', 'false');
    expect(await list()).toHaveLength(0);
  });

  test('re-taking the safety check changes caution mode and the map', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    const headers = await onHome(page, request, uniqueEmail(info, 'safety'));
    const label = () => page.getByTestId('stop-intro-6').getAttribute('aria-label');
    expect(await label()).toContain('Ready');

    await openProfile(page);
    await page.getByTestId('profile-help-link').click();
    await expect(page.getByTestId('help-screen')).toBeVisible();
    await expect(page.getByTestId('help-contacts')).toBeVisible();
    await expect(page.getByTestId('help-therapy-note')).toBeVisible();
    await page.getByTestId('retake-1-yes').click();
    await page.getByTestId('retake-save').click();
    await expect(page.getByTestId('retake-info')).toBeVisible();
    await page.getByTestId('retake-acknowledge').click();
    await expect(page.getByTestId('retake-result')).toBeVisible();
    await expect
      .poll(async () => (await serverSettings(request, headers)).safety)
      .toEqual({
        answers: [true, false, false],
        cautionMode: true,
      });

    await page.getByTestId('subpage-back').click();
    await page.getByTestId('tab-home').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    expect(await label()).toContain('Not suggested for you');

    // And back again.
    await openProfile(page);
    await page.getByTestId('profile-help-link').click();
    await page.getByTestId('retake-1-no').click();
    await page.getByTestId('retake-save').click();
    await expect(page.getByTestId('retake-result')).toBeVisible();
    await page.getByTestId('subpage-back').click();
    await page.getByTestId('tab-home').click();
    expect(await label()).toContain('Ready');
    expect(errors).toEqual([]);
  });

  test('exports my data as a block of JSON', async ({ page, request }, info) => {
    const email = uniqueEmail(info, 'export');
    await onHome(page, request, email, { moods: 1 });
    await openProfile(page);
    await page.getByTestId('profile-privacy-link').click();
    await expect(page.getByTestId('privacy-screen')).toBeVisible();
    await expect(page.getByTestId('privacy-stored')).toBeVisible();
    await page.getByTestId('export-data').click();
    const block = page.getByTestId('export-json');
    await expect(block).toBeVisible();
    const data = JSON.parse((await block.textContent()) ?? '{}') as {
      account: { email: string };
      documents: { settings: { crocName: string }; progress: { stops: object } };
      moodEntries: unknown[];
    };
    expect(data.account.email).toBe(email);
    expect(data.documents.settings.crocName).toBe('Zé');
    expect(Object.keys(data.documents.progress.stops)).toHaveLength(5);
    expect(data.moodEntries).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain('passwordHash');
    await expect(page.getByTestId('export-copy')).toBeVisible();
  });

  test('deleting the account needs the password', async ({ page, request }, info) => {
    const email = uniqueEmail(info, 'delete');
    await onHome(page, request, email);
    await openProfile(page);
    await page.getByTestId('profile-privacy-link').click();
    await page.getByTestId('profile-delete-account').click();
    await page.getByTestId('delete-confirm-button').click();
    await expect(page.getByTestId('delete-password-error')).toBeVisible();
    await page.getByTestId('delete-password').fill('wrong password');
    await page.getByTestId('delete-confirm-button').click();
    await expect(page.getByTestId('delete-error-message')).toContainText('not correct');
    // The API refuses without the password too.
    const headers = await apiHeaders(request, email);
    expect((await request.delete(`${API}/me`, { headers, data: {} })).status()).toBe(400);
    expect((await request.get(`${API}/me`, { headers })).status()).toBe(200);
    await page.getByTestId('delete-password').fill(PASSWORD);
    await page.getByTestId('delete-confirm-button').click();
    await expect(page.getByTestId('welcome-notice-message')).toHaveText(
      'Your account was deleted.',
    );
    expect((await request.get(`${API}/me`, { headers })).status()).toBe(401);
  });

  test('the pages fit the screen and every control is at least 44px', async ({
    page,
    request,
  }, info) => {
    await onHome(page, request, uniqueEmail(info, 'layout'));
    const check = async () => {
      const result = await page.evaluate(() => {
        const small: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(
          '[role="button"], [role="switch"], [role="radio"], input',
        )) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (el.closest('[aria-hidden="true"]')) continue;
          if (r.height < 43.5 || r.width < 43.5) {
            small.push(`${el.getAttribute('data-testid') ?? el.tagName} ${r.width}x${r.height}`);
          }
        }
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          small,
        };
      });
      expect(result.overflow).toBeLessThanOrEqual(0);
      expect(result.small).toEqual([]);
    };
    await openProfile(page);
    await page.getByTestId('setting-reminder').click();
    await check();
    await page.getByTestId('profile-help-link').click();
    await expect(page.getByTestId('help-screen')).toBeVisible();
    await check();
    await page.getByTestId('subpage-back').click();
    await page.getByTestId('profile-privacy-link').click();
    await expect(page.getByTestId('privacy-screen')).toBeVisible();
    await check();
  });

  test('a change made on another device shows when the tab is looked at again', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    const email = uniqueEmail(info, 'focus');
    const headers = await onHome(page, request, email);
    await openProfile(page);
    await expect(page.getByTestId('profile-croc-name')).toHaveText('Zé');

    // Another device (an older app writing a v1 document) renames the croc.
    const current = await serverSettings(request, headers);
    const { storedAt: _s, fieldsAt: _f, ...rest } = current;
    const res = await request.put(`${API}/me/settings`, {
      headers,
      data: { ...rest, crocName: 'Neu', updatedAt: Date.now() + 60_000 },
    });
    expect(res.status()).toBe(200);
    // Nothing yet: the tab does not poll.
    await expect(page.getByTestId('profile-croc-name')).toHaveText('Zé');

    // Coming back to the tab reads the documents again.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByTestId('profile-croc-name')).toHaveText('Neu');
    // The old device's write left the app's own v2 fields alone.
    expect((await serverSettings(request, headers)).crocName).toBe('Neu');
    expect(errors).toEqual([]);
  });
});
