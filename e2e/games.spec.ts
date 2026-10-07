import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// The throwaway account service started by playwright.config.ts.
const API = process.env.E2E_API_URL ?? 'http://localhost:4274';
const PASSWORD = 'river walk 1';
/** The games run this many times faster (dev-build hook, see src/features/games/clock.ts). */
const FAST = 40;
/** Slow enough that every firefly round and the eyes-closed moment can be seen. */
const STEADY = 8;

function uniqueEmail(info: TestInfo, tag: string): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `e2e-games-${tag}-${info.project.name}-${id}@example.com`;
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

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API}/auth/signin`, {
    data: { email, password: PASSWORD, clientId: 'mhp-hypnose' },
  });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { tokens: { accessToken: string } }).tokens.accessToken;
}

/** A user who finished onboarding with the Sleep goal and the first two Sleep stops, on home. */
async function onHome(page: Page, request: APIRequestContext, email: string, scale = FAST) {
  await page.addInitScript((s) => {
    (window as unknown as { __mhpTimeScale: number }).__mhpTimeScale = s;
  }, scale);
  await page.goto('/sign-up');
  await page.getByTestId('sign-up-name').fill('E2E Player');
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill(PASSWORD);
  await page.getByTestId('sign-up-submit').click();
  await expect(page.getByTestId('onboarding-goals')).toBeVisible();
  const headers = { authorization: `Bearer ${await token(request, email)}` };
  const now = Date.now();
  const onboarding = await request.put(`${API}/me/onboarding`, {
    headers,
    data: {
      version: 1,
      updatedAt: now + 1000,
      step: 'done',
      completed: true,
      completedAt: now,
      goals: ['sleep'],
      experience: 'new',
      timeOfDay: 'evening',
      sessionLength: 'medium',
      safety: { answers: [false, false, false], acknowledged: false },
      moodConsent: false,
      crocHatched: true,
      crocName: 'Zé',
      firstSession: { completed: true, moodBefore: null, moodAfter: null },
      reminder: 'skipped',
      rewardGranted: true,
    },
  });
  expect(onboarding.status()).toBe(200);
  const settings = await request.put(`${API}/me/settings`, {
    headers,
    data: {
      version: 1,
      updatedAt: now + 1000,
      crocName: 'Zé',
      goals: ['sleep'],
      experience: 'new',
      sessionLength: 'medium',
      reminder: { enabled: false, time: null, timeOfDay: 'evening' },
      moodConsent: false,
      safety: { answers: [false, false, false], cautionMode: false },
      sound: true,
      haptics: true,
    },
  });
  expect(settings.status()).toBe(200);
  const done = (at: number) => ({ status: 'done', updatedAt: at, completedAt: at });
  const progress = await request.put(`${API}/me/progress`, {
    headers,
    data: {
      version: 1,
      updatedAt: now + 1000,
      stops: { 'sleep-1': done(now - 2000), 'sleep-2': done(now - 1000) },
    },
  });
  expect(progress.status()).toBe(200);
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

/** Presses and holds the centre of an element for `ms` real milliseconds. */
async function hold(page: Page, testId: string, ms: number) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

const label = (page: Page, stopId: string) =>
  page.getByTestId(`stop-${stopId}`).getAttribute('aria-label');

test.describe('mini-games', () => {
  test('a game stop on the map opens Stillness; leaving keeps progress, finishing marks it done', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    // A slower clock than the others: Stillness counts what a resting finger measures, and at 40x
    // the pad appears with too little of the game left to measure.
    const headers = await onHome(page, request, uniqueEmail(info, 'map'), 10);
    await expect(page.getByTestId('today-title')).toHaveText('Sleep · Stop 3');

    // Sleep · Stop 3 is a game: it opens the game, not the session player.
    await page.getByTestId('stop-sleep-3').click();
    await expect(page.getByTestId('stop-sheet-type')).toHaveText('Game');
    await page.getByTestId('stop-sheet-start').click();
    await expect(page.getByTestId('game-intro-title')).toHaveText('Stillness');
    await expect(page.getByTestId('stillness-game')).toBeVisible();

    // Start, then leave through the pause: the stop is untouched (a game has no middle to resume).
    await page.getByTestId('game-start').click();
    await expect(page.getByTestId('stillness-pad')).toBeVisible({ timeout: 8000 });
    await page.getByTestId('game-pause').click();
    await expect(page.getByTestId('game-paused')).toBeVisible();
    await page.getByTestId('game-quit').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('today-title')).toHaveText('Sleep · Stop 3');
    expect(await label(page, 'sleep-3')).not.toContain('Started');
    expect(await label(page, 'sleep-3')).not.toContain('Done');

    // Left idle (a finger never rests on the pad) the game runs to its end but does not count.
    await page.getByTestId('today-play').click();
    await page.getByTestId('game-start').click();
    await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('game-not-counted')).toBeVisible();
    await expect(page.getByTestId('game-result')).toHaveCount(0);

    // Play it through: a finger resting on the lily pad until the end.
    await page.getByTestId('game-play-again').click();
    await expect(page.getByTestId('stillness-pad')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('stillness-cue')).toContainText('lily pad');
    const pad = await page.getByTestId('stillness-pad').boundingBox();
    expect(pad!.width).toBeGreaterThanOrEqual(44);
    await page.mouse.move(pad!.x + pad!.width / 2, pad!.y + pad!.height / 2);
    await page.mouse.down();
    await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 20_000 });
    await page.mouse.up();
    // The finger never moved: the whole game was still.
    const result = await page.getByTestId('game-result').textContent();
    expect(result).toMatch(/^\d+\/100 still$/);
    expect(Number(result!.split('/')[0])).toBeGreaterThanOrEqual(95);
    await page.getByTestId('game-done').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect.poll(() => label(page, 'sleep-3')).toContain('Done');
    await expect(page.getByTestId('today-title')).toHaveText('Sleep · Stop 4');
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/me/progress`, { headers });
        const body = (await res.json()) as {
          progress: { stops: Record<string, { status: string }> } | null;
        };
        return body.progress?.stops['sleep-3']?.status;
      })
      .toBe('done');
    expect(errors).toEqual([]);
  });

  test('the games clearing lists the games; Breathing counts held breaths and records the play', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    await onHome(page, request, uniqueEmail(info, 'breathing'));
    await page.getByTestId('tab-games').click();
    await expect(page.getByTestId('games-screen')).toBeVisible();
    for (const id of ['stillness', 'firefly', 'breathing']) {
      await expect(page.getByTestId(`game-card-${id}-plays`)).toHaveText('Not played yet');
    }
    await page.getByTestId('game-card-breathing').click();
    await expect(page.getByTestId('game-intro-title')).toHaveText('Breathing');
    await page.getByTestId('game-start').click();
    await expect(page.getByTestId('breathing-water')).toBeVisible();
    await expect(page.getByTestId('breathing-cue')).toBeVisible();
    // Three slow breaths (the minimum hold is 1.5 s of game time; taps are covered by unit tests).
    for (let i = 0; i < 3; i++) {
      await hold(page, 'breathing-water', 140);
      await page.waitForTimeout(60);
    }
    await expect(page.getByTestId('breathing-count')).toHaveText('3 breaths');
    await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('game-result')).toHaveText('3 breaths');
    await page.getByTestId('game-done').click();
    await expect(page.getByTestId('games-screen')).toBeVisible();
    await expect(page.getByTestId('game-card-breathing-plays')).toHaveText('Played once');
    await expect(page.getByTestId('game-card-breathing-best')).toHaveText('Best: 3 breaths');
    // The record survives a reload (the page comes back on the games tab).
    await page.reload();
    await expect(page.getByTestId('games-screen')).toBeVisible();
    await expect(page.getByTestId('game-card-breathing-plays')).toHaveText('Played once');
    expect(errors).toEqual([]);
  });

  test('Firefly runs three rounds and ends with eyes closed, also with reduced motion', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await onHome(page, request, uniqueEmail(info, 'firefly'), STEADY);
    await page.getByTestId('tab-games').click();
    await page.getByTestId('game-card-firefly').click();
    await expect(page.getByTestId('game-intro-title')).toHaveText('Firefly');
    await page.getByTestId('game-start').click();
    await expect(page.getByTestId('firefly-hero')).toBeVisible();
    await expect(page.getByTestId('firefly-round')).toHaveText('Round 1 of 3');
    await expect(page.getByTestId('firefly-round')).toHaveText('Round 3 of 3', { timeout: 15_000 });
    await expect(page.getByTestId('firefly-close-eyes')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('game-result')).toHaveText('3 of 3 rounds');
    // Play again starts clean.
    await page.getByTestId('game-play-again').click();
    await expect(page.getByTestId('firefly-round')).toHaveText('Round 1 of 3');
    await page.getByTestId('game-back').click();
    await page.getByTestId('game-quit').click();
    await expect(page.getByTestId('games-screen')).toBeVisible();
    await expect(page.getByTestId('game-card-firefly-plays')).toHaveText('Played once');
    expect(errors).toEqual([]);
  });
});
