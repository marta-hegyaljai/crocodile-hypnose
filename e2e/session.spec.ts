import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// The throwaway account service started by playwright.config.ts.
const API = process.env.E2E_API_URL ?? 'http://localhost:4274';
const PASSWORD = 'river walk 1';

function uniqueEmail(info: TestInfo, tag: string): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `e2e-session-${tag}-${info.project.name}-${id}@example.com`;
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

/**
 * A user who finished onboarding (Intro goal) with `done` stops already finished, signed in on
 * home. Returns the API headers.
 */
async function onHome(
  page: Page,
  request: APIRequestContext,
  email: string,
  { moodConsent, done }: { moodConsent: boolean; done: string[] },
) {
  await page.goto('/sign-up');
  await page.getByTestId('sign-up-name').fill('E2E Session');
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill(PASSWORD);
  await page.getByTestId('sign-up-submit').click();
  await expect(page.getByTestId('onboarding-goals')).toBeVisible();
  const signIn = await request.post(`${API}/auth/signin`, {
    data: { email, password: PASSWORD, clientId: 'mhp-hypnose' },
  });
  const token = ((await signIn.json()) as { tokens: { accessToken: string } }).tokens.accessToken;
  const headers = { authorization: `Bearer ${token}` };
  const now = Date.now();
  const put = async (kind: string, data: object) => {
    const res = await request.put(`${API}/me/${kind}`, { headers, data });
    expect(res.status()).toBe(200);
  };
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
    moodConsent,
    crocHatched: true,
    crocName: 'Zé',
    firstSession: { completed: true, moodBefore: null, moodAfter: null },
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
    moodConsent,
    safety: { answers: [false, false, false], cautionMode: false },
    sound: true,
    haptics: true,
  });
  await put('progress', {
    version: 1,
    updatedAt: now,
    stops: Object.fromEntries(
      done.map((id) => [id, { status: 'done', updatedAt: now - 1000, completedAt: now - 1000 }]),
    ),
  });
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

/** The dev-build hook: plays the next `seconds` of the session as if listened to. */
async function fastForward(page: Page, seconds: number) {
  await page.waitForFunction(() => !!(globalThis as { __mhpSession?: unknown }).__mhpSession);
  await page.evaluate((s) => {
    (
      globalThis as unknown as { __mhpSession: { fastForward(s: number): void } }
    ).__mhpSession.fastForward(s);
  }, seconds);
}

async function openStop(page: Page, stopId: string) {
  await page.getByTestId(`stop-${stopId}`).click();
  await page.getByTestId('stop-sheet-start').click();
  await expect(page.getByTestId('session-screen')).toBeVisible();
}

const label = (page: Page, stopId: string) =>
  page.getByTestId(`stop-${stopId}`).getAttribute('aria-label');

test.describe('sessions', () => {
  test('an audio stop end to end: mood before and after, reward, next stop unlocked; a replay earns no first-time bonus', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    const headers = await onHome(page, request, uniqueEmail(info, 'audio'), {
      moodConsent: true,
      done: ['intro-1'],
    });
    await expect(page.getByTestId('home-points')).toContainText('50');

    await openStop(page, 'intro-2');
    await expect(page.getByTestId('session-title')).toHaveText('Intro · Stop 2');
    await page.getByTestId('session-start').click();

    // Mood before (with consent), then into Night River.
    await page.getByTestId('mood-before-picker-2').click();
    await page.getByTestId('mood-before-continue').click();
    const player = page.getByTestId('session-player');
    await expect(player).toBeVisible();
    await expect(player.getByTestId('session-title')).toHaveText('Intro · Stop 2');
    // Nothing loud while it plays: no points, no reward.
    await expect(page.getByTestId('session-reward')).toHaveCount(0);
    await expect(player.getByText(/Points/)).toHaveCount(0);
    // Controls: pause and play, back 15 s, background sound.
    await player.getByTestId('session-toggle').click();
    await expect(player.getByTestId('session-toggle')).toHaveAttribute('aria-label', 'Play');
    await player.getByTestId('session-toggle').click();
    await expect(player.getByTestId('session-toggle')).toHaveAttribute('aria-label', 'Pause');
    await player.getByTestId('session-sound').click();
    await player.getByTestId('session-sound-river').click();
    await player.getByTestId('session-back15').click();

    // Listen to the whole track (fast-forwarded).
    await fastForward(page, 200);

    // Back in the day: mood after shows the change, then the reward.
    await expect(page.getByTestId('session-mood-after')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('mood-after-picker-4').click();
    await expect(page.getByTestId('mood-change')).toHaveAttribute(
      'aria-label',
      'Before: Mood 2 · After: Mood 4',
    );
    await page.getByTestId('mood-after-continue').click();
    await expect(page.getByTestId('session-reward')).toBeVisible();
    await expect(page.getByTestId('session-reward-points')).toHaveText('+30 Points');
    await expect(page.getByTestId('session-reward-first')).toBeVisible();
    await page.getByTestId('session-reward-continue').click();

    // Back on the map: the stop is done, the next one unlocks (with its animation), points up.
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('stop-intro-3-unlocking')).toBeAttached();
    await expect.poll(() => label(page, 'intro-2')).toContain('Done');
    await expect.poll(() => label(page, 'intro-3')).toContain('You are here');
    await expect(page.getByTestId('home-points')).toContainText('95');

    // The server has one completion (first time) and both mood check-ins.
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/me/events`, { headers });
        return ((await res.json()) as { events: { stopId: string; firstTime: boolean }[] }).events;
      })
      .toEqual([expect.objectContaining({ stopId: 'intro-2', firstTime: true })]);
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/me/mood`, { headers });
        const body = (await res.json()) as { entries: { phase: string; value: number }[] };
        return body.entries.map((e) => `${e.phase}:${e.value}`).sort();
      })
      .toEqual(['after:4', 'before:2']);

    // A replay: no mood this time (skipped), no first-time bonus.
    await openStop(page, 'intro-2');
    await page.getByTestId('session-start').click();
    await page.getByTestId('mood-before-skip').click();
    await expect(page.getByTestId('session-player')).toBeVisible();
    await fastForward(page, 200);
    await page.getByTestId('mood-after-skip').click();
    await expect(page.getByTestId('session-reward-points')).toHaveText('+10 Points');
    await expect(page.getByTestId('session-reward-first')).toHaveCount(0);
    await page.getByTestId('session-reward-continue').click();
    await expect(page.getByTestId('home-points')).toContainText('105');
    expect(errors).toEqual([]);
  });

  test('an interrupted session resumes where it stopped, and ending early does not finish it', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    await onHome(page, request, uniqueEmail(info, 'resume'), {
      moodConsent: false,
      done: ['intro-1'],
    });
    await openStop(page, 'intro-2');
    await page.getByTestId('session-start').click();
    await expect(page.getByTestId('session-player')).toBeVisible();
    await fastForward(page, 40);
    // The place is saved while it plays.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const key = Object.keys(localStorage).find((k) => k.startsWith('mhp.hypnose.playback'));
          const saved = key ? JSON.parse(localStorage.getItem(key)!) : {};
          return saved['intro-2']?.position ?? 0;
        }),
      )
      .toBeGreaterThanOrEqual(40);

    // The app is closed mid-session (reload): resume or restart.
    await page.reload();
    await expect(page.getByTestId('session-screen')).toBeVisible();
    await expect(page.getByTestId('session-restart')).toBeVisible();
    await expect(page.getByTestId('session-resume')).toContainText(/Resume at 0:[45]\d/);
    await page.getByTestId('session-resume').click();
    const player = page.getByTestId('session-player');
    await expect(player).toBeVisible();
    await expect
      .poll(async () => (await player.getByTestId('session-elapsed').textContent()) ?? '')
      .toMatch(/^0:[45]\d$/);

    // Ending early is not finishing.
    await player.getByTestId('session-end').click();
    await page.getByTestId('session-end-confirm').click();
    await expect(page.getByTestId('session-intro-body')).toBeVisible();
    await expect(page.getByTestId('session-resume')).toBeVisible();
    await page.getByTestId('session-back').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect.poll(() => label(page, 'intro-2')).not.toContain('Done');

    // Resume again and listen to the rest: done.
    await openStop(page, 'intro-2');
    await page.getByTestId('session-resume').click();
    await expect(page.getByTestId('session-player')).toBeVisible();
    await fastForward(page, 200);
    await expect(page.getByTestId('session-reward')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('session-reward-continue').click();
    await expect.poll(() => label(page, 'intro-2')).toContain('Done');
    expect(errors).toEqual([]);
  });

  test('a video lesson with captions and a visual exercise', async ({ page, request }, info) => {
    const errors = collectErrors(page);
    await onHome(page, request, uniqueEmail(info, 'media'), {
      moodConsent: false,
      done: ['intro-3'],
    });
    // The video lesson (intro-1): captions toggle, then watched to the end.
    await openStop(page, 'intro-1');
    await page.getByTestId('session-start').click();
    const player = page.getByTestId('session-player');
    await expect(player).toBeVisible();
    await expect(player.getByTestId('session-video')).toBeVisible();
    await expect(player.getByTestId('session-captions')).toHaveAttribute(
      'aria-label',
      'Hide captions',
    );
    await player.getByTestId('session-captions').click();
    await expect(player.getByTestId('session-captions')).toHaveAttribute(
      'aria-label',
      'Show captions',
    );
    await player.getByTestId('session-captions').click();
    await fastForward(page, 2);
    await expect(player.getByTestId('session-caption')).toContainText('[Caption');
    await fastForward(page, 30);
    await expect(page.getByTestId('session-reward')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('session-reward-continue').click();

    // The visual exercise (intro-4): a calm sequence on a clock.
    await openStop(page, 'intro-4');
    await page.getByTestId('session-start').click();
    await expect(page.getByTestId('visual-fixation')).toBeVisible();
    await fastForward(page, 70);
    await expect(page.getByTestId('visual-breathing')).toBeVisible();
    await fastForward(page, 70);
    await expect(page.getByTestId('visual-imagery')).toBeVisible();
    await fastForward(page, 100);
    await expect(page.getByTestId('session-reward')).toBeVisible({ timeout: 10_000 });
    expect(errors).toEqual([]);
  });
});
