import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

// The throwaway account service started by playwright.config.ts.
const API = process.env.E2E_API_URL ?? 'http://localhost:4274';
const PASSWORD = 'river walk 1';

function uniqueEmail(info: TestInfo, tag: string): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `e2e-onb-${tag}-${info.project.name}-${id}@example.com`;
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

/**
 * The web stack keeps earlier screens mounted, so controls that every step has (Continue, Back)
 * are looked up inside the step's own screen.
 */
function step(page: Page, screenId: string): Locator {
  return page.getByTestId(screenId);
}

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

async function apiTokens(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/auth/signin`, {
    data: { email, password: PASSWORD, clientId: 'mhp-hypnose' },
  });
  expect(res.status(), `${email}: ${await res.text()}`).toBe(200);
  const { tokens } = (await res.json()) as { tokens: { accessToken: string } };
  return tokens.accessToken;
}

async function hatch(page: Page, screen: Locator) {
  const egg = screen.getByTestId('hatch-egg');
  for (let i = 0; i < 3; i++) {
    await egg.click();
    // The screen ignores a second tap within 220 ms (a bounce).
    await page.waitForTimeout(260);
  }
  await expect(screen.getByTestId('hatch-done')).toBeVisible();
  await expect(screen.getByTestId('croc-name')).toBeVisible({ timeout: 5000 });
}

test.describe('onboarding', () => {
  test('from sign-up to home, resuming after a reload', async ({ page, request }, info) => {
    const errors = collectErrors(page);
    const email = uniqueEmail(info, 'flow');
    await signUpInUi(page, email);

    // 1. Goals: at most two, and Continue needs at least one.
    const goals = step(page, 'onboarding-goals');
    await expect(goals).toBeVisible();
    await expect(goals.getByTestId('onboarding-step-label')).toHaveText('Step 1 of 7');
    await expect(goals.getByTestId('onboarding-continue')).toBeDisabled();
    await goals.getByTestId('goal-sleep').click();
    await goals.getByTestId('goal-focus').click();
    await goals.getByTestId('goal-habits').click();
    await expect(goals.getByTestId('goals-limit')).toBeVisible();
    await expect(goals.getByTestId('goal-habits')).toHaveAttribute('aria-checked', 'false');
    await goals.getByTestId('onboarding-continue').click();

    // 2. Experience and timing.
    const experience = step(page, 'onboarding-experience');
    await expect(experience).toBeVisible();
    await experience.getByTestId('experience-new').click();
    await experience.getByTestId('time-evening').click();
    await experience.getByTestId('length-short').click();

    // Reload in the middle: back on the same step, answers kept, nothing re-asked.
    await page.reload();
    const experienceAgain = step(page, 'onboarding-experience');
    await expect(experienceAgain).toBeVisible();
    await expect(experienceAgain.getByTestId('length-short')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(experienceAgain.getByTestId('experience-new')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Back keeps the goals.
    await experienceAgain.getByTestId('onboarding-back').click();
    const goalsAgain = step(page, 'onboarding-goals');
    await expect(goalsAgain).toBeVisible();
    await expect(goalsAgain.getByTestId('goal-focus')).toHaveAttribute('aria-checked', 'true');
    await goalsAgain.getByTestId('onboarding-continue').click();
    const experienceBack = step(page, 'onboarding-experience');
    await expect(experienceBack).toBeVisible();
    await experienceBack.getByTestId('onboarding-continue').click();

    // 3. Safety: a "yes" shows the calm information, which has to be acknowledged.
    const safety = step(page, 'onboarding-safety');
    await expect(safety).toBeVisible();
    await expect(safety.getByTestId('safety-question-1')).toHaveText('[Safety question 1]');
    await safety.getByTestId('safety-1-no').click();
    await safety.getByTestId('safety-2-yes').click();
    await safety.getByTestId('safety-3-no').click();
    await safety.getByTestId('onboarding-continue').click();
    const info1 = step(page, 'onboarding-safety-info');
    await expect(info1).toBeVisible();
    await info1.getByTestId('safety-acknowledge').click();

    // 4. Consent.
    const consent = step(page, 'onboarding-consent');
    await expect(consent).toBeVisible();
    await consent.getByTestId('consent-allow').click();
    await consent.getByTestId('onboarding-continue').click();

    // 5. Hatch: three taps, then a valid name.
    const hatchScreen = step(page, 'onboarding-hatch');
    await expect(hatchScreen).toBeVisible();
    await expect(hatchScreen.getByTestId('hatch-hint')).toHaveText('Tap the egg 3 times');
    await hatch(page, hatchScreen);
    await hatchScreen.getByTestId('croc-name').fill('   ');
    await hatchScreen.getByTestId('onboarding-continue').click();
    await expect(hatchScreen.getByTestId('croc-name-error')).toHaveText('Enter a name.');
    await hatchScreen.getByTestId('croc-name').fill('Zé 🐊');
    await hatchScreen.getByTestId('onboarding-continue').click();

    // 6. First session: mood before (consent given), sink into Night River, play, surface.
    const session = step(page, 'onboarding-first-session');
    await expect(session).toBeVisible();
    await session.getByTestId('mood-before-3').click();
    await session.getByTestId('first-session-start').click();
    const player = page.getByTestId('first-session-player');
    await expect(player).toBeVisible({ timeout: 10_000 });
    await expect(player.getByTestId('breathing-cue')).toBeVisible();
    await player.getByTestId('first-session-toggle').click();
    await expect(player.getByTestId('first-session-toggle')).toHaveAttribute('aria-label', 'Play');
    await player.getByTestId('first-session-toggle').click();
    await player.getByTestId('first-session-dev-skip').click();
    const after = step(page, 'onboarding-first-session-after');
    await expect(after).toBeVisible({ timeout: 10_000 });
    await after.getByTestId('mood-after-4').click();
    await after.getByTestId('onboarding-continue').click();

    // 7. Reminder: not available in the browser, explained, skippable.
    const reminder = step(page, 'onboarding-reminder');
    await expect(reminder).toBeVisible();
    await expect(reminder.getByTestId('reminder-time')).toHaveText('Every day at 20:30');
    await expect(reminder.getByTestId('reminder-web')).toBeVisible();
    await reminder.getByTestId('reminder-skip').click();

    // 8. Done: first points, then home with the named hatchling.
    const done = step(page, 'onboarding-done');
    await expect(done).toBeVisible();
    await expect(done.getByTestId('done-points')).toHaveText('+50 Points');
    await expect(done.getByTestId('done-croc')).toHaveText('Zé 🐊 is with you');
    await done.getByTestId('onboarding-finish').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Zé 🐊, Stage 2' })).toBeVisible();

    // Everything reached the server, including the consented mood values.
    const token = await apiTokens(request, email);
    const stored = await request.get(`${API}/me/onboarding`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(stored.status()).toBe(200);
    const { onboarding } = (await stored.json()) as { onboarding: Record<string, unknown> };
    expect(onboarding).toMatchObject({
      completed: true,
      step: 'done',
      goals: ['sleep', 'focus'],
      crocName: 'Zé 🐊',
      moodConsent: true,
      safety: { answers: [false, true, false], acknowledged: true },
      firstSession: { completed: true, moodBefore: 3, moodAfter: 4 },
      reminder: 'unavailable',
      rewardGranted: true,
    });
    const settings = await request.get(`${API}/me/settings`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect((await settings.json()).settings).toMatchObject({
      crocName: 'Zé 🐊',
      sessionLength: 'short',
      reminder: { enabled: false, time: '20:30', timeOfDay: 'evening' },
      safety: { cautionMode: true },
      moodConsent: true,
    });

    // Finished onboarding never shows again: a reload, and signing out and in, land on home.
    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.goto('/onboarding/goals');
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.getByTestId('home-sign-out').click();
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    await page.getByTestId('welcome-sign-in').click();
    await page.getByTestId('sign-in-email').fill(email);
    await page.getByTestId('sign-in-password').fill(PASSWORD);
    await page.getByTestId('sign-in-password').press('Enter');
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('onboarding-goals')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a second device skips a finished onboarding and resumes an unfinished one', async ({
    browser,
    page,
    request,
  }, info) => {
    const email = uniqueEmail(info, 'device');
    await signUpInUi(page, email);
    const goals = step(page, 'onboarding-goals');
    await goals.getByTestId('goal-stress').click();
    await goals.getByTestId('onboarding-continue').click();
    await expect(step(page, 'onboarding-experience')).toBeVisible();

    // Another device, nothing stored locally: it waits for the server and resumes the same step.
    const other = await browser.newContext({ viewport: page.viewportSize() });
    const page2 = await other.newPage();
    await page2.goto('/sign-in');
    await page2.getByTestId('sign-in-email').fill(email);
    await page2.getByTestId('sign-in-password').fill(PASSWORD);
    await page2.getByTestId('sign-in-password').press('Enter');
    const experience2 = step(page2, 'onboarding-experience');
    await expect(experience2).toBeVisible();
    await expect(experience2.getByTestId('onboarding-step-label')).toHaveText('Step 2 of 7');
    await other.close();

    // Onboarding finished elsewhere (here: through the API): this device goes to home on reload.
    const token = await apiTokens(request, email);
    const finished = {
      version: 1,
      updatedAt: Date.now() + 1000,
      step: 'done',
      completed: true,
      completedAt: Date.now(),
      goals: ['stress'],
      experience: 'experienced',
      timeOfDay: 'morning',
      sessionLength: 'long',
      safety: { answers: [false, false, false], acknowledged: false },
      moodConsent: false,
      crocHatched: true,
      crocName: 'Remote',
      firstSession: { completed: true, moodBefore: null, moodAfter: null },
      reminder: 'skipped',
      rewardGranted: true,
    };
    const put = await request.put(`${API}/me/onboarding`, {
      headers: { authorization: `Bearer ${token}` },
      data: finished,
    });
    expect(put.status()).toBe(200);
    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });

  test('declined consent: no mood checks, the first session still completes', async ({
    page,
  }, info) => {
    await signUpInUi(page, uniqueEmail(info, 'noconsent'));
    const goals = step(page, 'onboarding-goals');
    await goals.getByTestId('goal-habits').click();
    await goals.getByTestId('onboarding-continue').click();
    const experience = step(page, 'onboarding-experience');
    await experience.getByTestId('experience-experienced').click();
    await experience.getByTestId('time-morning').click();
    await experience.getByTestId('length-medium').click();
    await experience.getByTestId('onboarding-continue').click();
    const safety = step(page, 'onboarding-safety');
    for (const i of [1, 2, 3]) await safety.getByTestId(`safety-${i}-no`).click();
    await safety.getByTestId('onboarding-continue').click();
    // No "yes": no information screen.
    const consent = step(page, 'onboarding-consent');
    await expect(consent).toBeVisible();
    await consent.getByTestId('consent-decline').click();
    await consent.getByTestId('onboarding-continue').click();
    const hatchScreen = step(page, 'onboarding-hatch');
    await hatch(page, hatchScreen);
    // The default name is fine.
    await expect(hatchScreen.getByTestId('croc-name')).toHaveValue('Croc');
    await hatchScreen.getByTestId('onboarding-continue').click();
    const session = step(page, 'onboarding-first-session');
    await expect(session).toBeVisible();
    await expect(session.getByTestId('mood-before-3')).toHaveCount(0);
    await session.getByTestId('first-session-start').click();
    const player = page.getByTestId('first-session-player');
    await expect(player).toBeVisible({ timeout: 10_000 });
    await player.getByTestId('first-session-dev-skip').click();
    const after = step(page, 'onboarding-first-session-after');
    await expect(after).toBeVisible({ timeout: 10_000 });
    await expect(after.getByTestId('mood-after-3')).toHaveCount(0);
    await after.getByTestId('onboarding-continue').click();
    const reminder = step(page, 'onboarding-reminder');
    await expect(reminder.getByTestId('reminder-time')).toHaveText('Every day at 08:00');
    await reminder.getByTestId('reminder-skip').click();
    await expect(step(page, 'onboarding-done')).toBeVisible();
  });

  test('every step fits the phone and keeps 44px targets', async ({ page }, info) => {
    await signUpInUi(page, uniqueEmail(info, 'fit'));
    const screens = [
      'onboarding-goals',
      'onboarding-experience',
      'onboarding-safety',
      'onboarding-consent',
      'onboarding-hatch',
    ];
    const fill: Record<string, (s: Locator) => Promise<void>> = {
      'onboarding-goals': async (s) => {
        await s.getByTestId('goal-sleep').click();
      },
      'onboarding-experience': async (s) => {
        await s.getByTestId('experience-new').click();
        await s.getByTestId('time-evening').click();
        await s.getByTestId('length-long').click();
      },
      'onboarding-safety': async (s) => {
        for (const i of [1, 2, 3]) await s.getByTestId(`safety-${i}-no`).click();
      },
      'onboarding-consent': async (s) => {
        await s.getByTestId('consent-allow').click();
      },
      'onboarding-hatch': async () => undefined,
    };
    for (const id of screens) {
      const s = step(page, id);
      await expect(s).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, id).toBe(false);
      for (const button of await s.getByRole('button').all()) {
        if (!(await button.isVisible())) continue;
        const box = await button.boundingBox();
        expect(
          box!.height,
          `${id} ${await button.getAttribute('aria-label')}`,
        ).toBeGreaterThanOrEqual(44);
        expect(
          box!.width,
          `${id} ${await button.getAttribute('aria-label')}`,
        ).toBeGreaterThanOrEqual(44);
      }
      for (const option of await s.getByRole('checkbox').or(s.getByRole('radio')).all()) {
        if (!(await option.isVisible())) continue;
        const box = await option.boundingBox();
        expect(box!.height, `${id} option`).toBeGreaterThanOrEqual(44);
      }
      await fill[id]!(s);
      if (id !== 'onboarding-hatch') await s.getByTestId('onboarding-continue').click();
    }
  });

  test('reduced motion: the hatch and the session transition still complete', async ({
    browser,
  }, info) => {
    const ctx = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    const errors = collectErrors(page);
    await signUpInUi(page, uniqueEmail(info, 'rm'));
    const goals = step(page, 'onboarding-goals');
    await goals.getByTestId('goal-focus').click();
    await goals.getByTestId('onboarding-continue').click();
    const experience = step(page, 'onboarding-experience');
    await experience.getByTestId('experience-new').click();
    await experience.getByTestId('time-evening').click();
    await experience.getByTestId('length-short').click();
    await experience.getByTestId('onboarding-continue').click();
    const safety = step(page, 'onboarding-safety');
    for (const i of [1, 2, 3]) await safety.getByTestId(`safety-${i}-no`).click();
    await safety.getByTestId('onboarding-continue').click();
    const consent = step(page, 'onboarding-consent');
    await consent.getByTestId('consent-decline').click();
    await consent.getByTestId('onboarding-continue').click();
    const hatchScreen = step(page, 'onboarding-hatch');
    await hatch(page, hatchScreen);
    await hatchScreen.getByTestId('onboarding-continue').click();
    const session = step(page, 'onboarding-first-session');
    await session.getByTestId('first-session-start').click();
    const player = page.getByTestId('first-session-player');
    await expect(player).toBeVisible({ timeout: 10_000 });
    await player.getByTestId('first-session-dev-skip').click();
    await expect(step(page, 'onboarding-first-session-after')).toBeVisible({ timeout: 10_000 });
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('onboarding: fix round 1', () => {
  test('two tabs: a tab left on an earlier step follows the tab that finished', async ({
    page,
    context,
    request,
  }, info) => {
    const email = uniqueEmail(info, 'tabs');
    await signUpInUi(page, email);
    const goals = step(page, 'onboarding-goals');
    await goals.getByTestId('goal-sleep').click();
    await goals.getByTestId('onboarding-continue').click();
    await expect(step(page, 'onboarding-experience')).toBeVisible();

    // Tab B finishes onboarding (through the API, as a device would).
    const token = await apiTokens(request, email);
    const finished = {
      version: 1,
      updatedAt: Date.now(),
      step: 'done',
      completed: true,
      completedAt: Date.now(),
      goals: ['sleep'],
      experience: 'new',
      timeOfDay: 'evening',
      sessionLength: 'short',
      safety: { answers: [false, false, false], acknowledged: false },
      moodConsent: false,
      crocHatched: true,
      crocName: 'Done',
      firstSession: { completed: true, moodBefore: null, moodAfter: null },
      reminder: 'skipped',
      rewardGranted: true,
    };
    const tabB = await context.newPage();
    await tabB.goto('/onboarding');
    await expect(step(tabB, 'onboarding-experience')).toBeVisible();
    const put = await request.put(`${API}/me/onboarding`, {
      headers: { authorization: `Bearer ${token}` },
      data: finished,
    });
    expect(put.status()).toBe(200);
    await tabB.reload();
    await expect(tabB.getByTestId('home-screen')).toBeVisible();

    // Tab A, still on Experience, follows (the device copy changed) and cannot undo anything.
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 10_000 });
    const stored = await request.get(`${API}/me/onboarding`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect((await stored.json()).onboarding).toMatchObject({ completed: true, crocName: 'Done' });
    await tabB.close();
  });

  test('a stale device cannot undo a finished onboarding', async ({ page, request }, info) => {
    const email = uniqueEmail(info, 'stale');
    await signUpInUi(page, email);
    const goals = step(page, 'onboarding-goals');
    await goals.getByTestId('goal-sleep').click();
    await goals.getByTestId('onboarding-continue').click();
    const experience = step(page, 'onboarding-experience');
    await expect(experience).toBeVisible();
    // Another device finishes while this one is offline (storage events do not cross devices).
    await page.route(`${API}/me/**`, (route) => route.abort('connectionrefused'));
    const token = await apiTokens(request, email);
    await request.put(`${API}/me/onboarding`, {
      headers: { authorization: `Bearer ${token}` },
      data: {
        version: 1,
        updatedAt: Date.now(),
        step: 'done',
        completed: true,
        completedAt: Date.now(),
        goals: ['sleep'],
        experience: 'experienced',
        timeOfDay: 'morning',
        sessionLength: 'long',
        safety: { answers: [false, false, false], acknowledged: false },
        moodConsent: false,
        crocHatched: true,
        crocName: 'Other',
        firstSession: { completed: true, moodBefore: null, moodAfter: null },
        reminder: 'skipped',
        rewardGranted: true,
      },
    });
    // The stale device taps (newer timestamp) and comes back online.
    await experience.getByTestId('time-morning').click();
    await page.unroute(`${API}/me/**`);
    await experience.getByTestId('experience-new').click();
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 10_000 });
    const stored = await request.get(`${API}/me/onboarding`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect((await stored.json()).onboarding).toMatchObject({ completed: true, crocName: 'Other' });
  });

  test('a second device on a slow network shows a loading screen, never a fresh onboarding', async ({
    browser,
    page,
    request,
  }, info) => {
    const email = uniqueEmail(info, 'slow');
    await signUpInUi(page, email);
    const token = await apiTokens(request, email);
    await request.put(`${API}/me/onboarding`, {
      headers: { authorization: `Bearer ${token}` },
      data: {
        version: 1,
        updatedAt: Date.now() + 1000,
        step: 'done',
        completed: true,
        completedAt: Date.now(),
        goals: ['sleep'],
        experience: 'new',
        timeOfDay: 'evening',
        sessionLength: 'short',
        safety: { answers: [false, false, false], acknowledged: false },
        moodConsent: false,
        crocHatched: true,
        crocName: 'Slow',
        firstSession: { completed: true, moodBefore: null, moodAfter: null },
        reminder: 'skipped',
        rewardGranted: true,
      },
    });
    const other = await browser.newContext({ viewport: page.viewportSize() });
    const page2 = await other.newPage();
    await page2.route(`${API}/me/onboarding`, async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    });
    await page2.goto('/sign-in');
    await page2.getByTestId('sign-in-email').fill(email);
    await page2.getByTestId('sign-in-password').fill(PASSWORD);
    await page2.getByTestId('sign-in-password').press('Enter');
    await expect(page2.getByTestId('profile-loading')).toBeVisible();
    await expect(page2.getByTestId('onboarding-goals')).toHaveCount(0);
    await expect(page2.getByTestId('home-screen')).toBeVisible({ timeout: 15_000 });
    await other.close();
  });

  test('withdrawing consent clears the mood values on the server too', async ({
    page,
    request,
  }, info) => {
    const email = uniqueEmail(info, 'consent');
    await signUpInUi(page, email);
    const goals = step(page, 'onboarding-goals');
    await goals.getByTestId('goal-sleep').click();
    await goals.getByTestId('onboarding-continue').click();
    const experience = step(page, 'onboarding-experience');
    await experience.getByTestId('experience-new').click();
    await experience.getByTestId('time-evening').click();
    await experience.getByTestId('length-short').click();
    await experience.getByTestId('onboarding-continue').click();
    const safety = step(page, 'onboarding-safety');
    for (const i of [1, 2, 3]) await safety.getByTestId(`safety-${i}-no`).click();
    await safety.getByTestId('onboarding-continue').click();
    const consent = step(page, 'onboarding-consent');
    await consent.getByTestId('consent-allow').click();
    await consent.getByTestId('onboarding-continue').click();
    const hatchScreen = step(page, 'onboarding-hatch');
    await hatch(page, hatchScreen);
    await hatchScreen.getByTestId('onboarding-continue').click();
    const session = step(page, 'onboarding-first-session');
    await session.getByTestId('mood-before-1').click();
    await session.getByTestId('first-session-start').click();
    const player = page.getByTestId('first-session-player');
    await expect(player).toBeVisible({ timeout: 10_000 });
    await player.getByTestId('first-session-dev-skip').click();
    const after = step(page, 'onboarding-first-session-after');
    await expect(after).toBeVisible({ timeout: 10_000 });
    await after.getByTestId('mood-after-5').click();
    await after.getByTestId('onboarding-continue').click();
    await expect(step(page, 'onboarding-reminder')).toBeVisible();
    const token = await apiTokens(request, email);
    const headers = { authorization: `Bearer ${token}` };
    await expect
      .poll(
        async () =>
          (await (await request.get(`${API}/me/onboarding`, { headers })).json()).onboarding
            .firstSession,
      )
      .toEqual({ completed: true, moodBefore: 1, moodAfter: 5 });

    // Back to Consent and decline: the values are gone, locally and on the server.
    await page.goto('/onboarding/consent');
    const consentAgain = step(page, 'onboarding-consent');
    await expect(consentAgain).toBeVisible();
    await consentAgain.getByTestId('consent-decline').click();
    await expect
      .poll(
        async () =>
          (await (await request.get(`${API}/me/onboarding`, { headers })).json()).onboarding,
      )
      .toMatchObject({
        moodConsent: false,
        firstSession: { completed: true, moodBefore: null, moodAfter: null },
      });
  });

  test('a double tap on Continue moves one step only', async ({ page }, info) => {
    await signUpInUi(page, uniqueEmail(info, 'dbl'));
    const goals = step(page, 'onboarding-goals');
    await goals.getByTestId('goal-sleep').click();
    await goals.getByTestId('onboarding-continue').click();
    const experience = step(page, 'onboarding-experience');
    await experience.getByTestId('experience-new').click();
    await experience.getByTestId('time-evening').click();
    await experience.getByTestId('length-short').click();
    await experience.getByTestId('onboarding-continue').click();
    const safety = step(page, 'onboarding-safety');
    await safety.getByTestId('safety-1-yes').click();
    await safety.getByTestId('safety-2-no').click();
    await safety.getByTestId('safety-3-no').click();
    // Safety with a "yes": the information must not be acknowledged by the second tap.
    await safety.getByTestId('onboarding-continue').dblclick();
    await expect(step(page, 'onboarding-safety-info')).toBeVisible();
    await page.waitForTimeout(600);
    await expect(step(page, 'onboarding-safety-info')).toBeVisible();
    await expect(step(page, 'onboarding-consent')).toHaveCount(0);
    await step(page, 'onboarding-safety-info').getByTestId('safety-acknowledge').dblclick();
    const consent = step(page, 'onboarding-consent');
    await expect(consent).toBeVisible();
    await page.waitForTimeout(600);
    await expect(step(page, 'onboarding-hatch')).toHaveCount(0);
  });

  test('the first session can be ended early from inside the player', async ({ page }, info) => {
    await signUpInUi(page, uniqueEmail(info, 'end'));
    const goals = step(page, 'onboarding-goals');
    await goals.getByTestId('goal-focus').click();
    await goals.getByTestId('onboarding-continue').click();
    const experience = step(page, 'onboarding-experience');
    await experience.getByTestId('experience-new').click();
    await experience.getByTestId('time-evening').click();
    await experience.getByTestId('length-short').click();
    await experience.getByTestId('onboarding-continue').click();
    const safety = step(page, 'onboarding-safety');
    for (const i of [1, 2, 3]) await safety.getByTestId(`safety-${i}-no`).click();
    await safety.getByTestId('onboarding-continue').click();
    const consent = step(page, 'onboarding-consent');
    await consent.getByTestId('consent-decline').click();
    await consent.getByTestId('onboarding-continue').click();
    const hatchScreen = step(page, 'onboarding-hatch');
    await hatch(page, hatchScreen);
    await hatchScreen.getByTestId('onboarding-continue').click();
    const session = step(page, 'onboarding-first-session');
    await session.getByTestId('first-session-start').click();
    const player = page.getByTestId('first-session-player');
    await expect(player).toBeVisible({ timeout: 10_000 });
    await player.getByTestId('first-session-toggle').click();
    await player.getByTestId('first-session-end').click();
    await player.getByTestId('first-session-end-cancel').click();
    await player.getByTestId('first-session-end').click();
    await player.getByTestId('first-session-end-confirm').click();
    const intro = step(page, 'onboarding-first-session');
    await expect(intro).toBeVisible({ timeout: 10_000 });
    await expect(intro.getByTestId('onboarding-title')).toHaveText('Session ended');
    await expect(intro.getByTestId('onboarding-continue')).toHaveCount(0);
    // Sign out is reachable from onboarding, and progress is kept.
    await intro.getByTestId('onboarding-menu').click();
    await intro.getByTestId('onboarding-sign-out').click();
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
  });
});
