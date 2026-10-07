import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// The throwaway account service started by playwright.config.ts.
const API = process.env.E2E_API_URL ?? 'http://localhost:4274';
const PASSWORD = 'river walk 1';

function uniqueEmail(info: TestInfo, tag: string): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `e2e-a11y-${tag}-${info.project.name}-${id}@example.com`;
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

/** A user who finished onboarding with Intro stop 1 done, on home. `scale` speeds up the games. */
async function onHome(page: Page, request: APIRequestContext, email: string, scale = 1) {
  await page.addInitScript((s) => {
    (window as unknown as { __mhpTimeScale: number }).__mhpTimeScale = s;
  }, scale);
  await page.goto('/sign-up');
  await page.getByTestId('sign-up-name').fill('E2E Access');
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
    moodConsent: false,
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
    moodConsent: false,
    safety: { answers: [false, false, false], cautionMode: false },
    sound: true,
    haptics: true,
  });
  await put('progress', {
    version: 1,
    updatedAt: now + 1000,
    stops: { 'intro-1': { status: 'done', updatedAt: now - 1000, completedAt: now - 1000 } },
  });
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('mhp.hypnose.') && !key.startsWith('mhp.hypnose.session')) {
        localStorage.removeItem(key);
      }
    }
  });
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
}

/** Where keyboard focus is: the test id of the element and whether it sits inside `testId`. */
const focusInside = (page: Page, testId: string) =>
  page.evaluate((id) => !!document.activeElement?.closest(`[data-testid="${id}"]`), testId);

test.describe('accessibility', () => {
  test('inactive tabs leave the tab order and the accessibility tree', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    await onHome(page, request, uniqueEmail(info, 'tabs'));
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-screen')).toBeVisible();
    // Home is still mounted (it keeps its state) but hidden from sight, focus and screen readers.
    await expect(page.getByTestId('home-screen')).toBeHidden();
    expect(
      await page.locator('[aria-hidden="true"]:has([data-testid="home-screen"])').count(),
    ).toBeGreaterThan(0);
    // Tab through the whole page: focus never lands in the hidden Home.
    await page.getByTestId('profile-sign-out').focus();
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInside(page, 'home-screen')).toBe(false);
    }
    await page.getByTestId('tab-home').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('profile-screen')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('radio groups are named and the arrow keys move and pick', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    await onHome(page, request, uniqueEmail(info, 'radio'));
    await page.getByTestId('tab-profile').click();
    const group = page.getByRole('radiogroup', { name: 'Default session length' });
    await expect(group).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Motion' })).toBeVisible();

    await page.getByTestId('setting-length-medium').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('setting-length-long')).toBeFocused();
    await expect(page.getByTestId('setting-length-long')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('setting-length-short')).toBeFocused();
    await expect(page.getByTestId('setting-length-short')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('setting-length-long')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('setting-length-short')).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('Escape closes the delete confirmation, the stop sheet and the end-session dialog', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    await onHome(page, request, uniqueEmail(info, 'escape'));

    // The stop sheet.
    await page.getByTestId('stop-intro-2').click();
    await expect(page.getByTestId('stop-sheet')).toBeVisible();
    // Focus moves into the sheet once it has opened.
    await expect.poll(() => focusInside(page, 'stop-sheet')).toBe(true);
    // The sheet takes Escape once its slide-in has finished: press until it closes.
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('stop-sheet')).toBeHidden({ timeout: 800 });
    }).toPass({ timeout: 8000 });

    // The end-session dialog: Escape keeps going, focus stays inside while it is open.
    await page.getByTestId('stop-intro-2').click();
    await page.getByTestId('stop-sheet-start').click();
    await page.getByTestId('session-start').click();
    const player = page.getByTestId('session-player');
    await expect(player).toBeVisible();
    await player.getByTestId('session-end').click();
    await expect(page.getByTestId('session-end-dialog')).toBeVisible();
    await expect.poll(() => focusInside(page, 'session-end-dialog')).toBe(true);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInside(page, 'session-end-dialog')).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('session-end-dialog')).toBeHidden();
    await expect(player).toBeVisible();
    // Ending for real still works from the dialog.
    await player.getByTestId('session-end').click();
    await page.getByTestId('session-end-confirm').click();
    await expect(page.getByTestId('session-screen')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('session-back').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();

    // The delete confirmation.
    await page.getByTestId('tab-profile').click();
    await page.getByTestId('profile-privacy-link').click();
    await page.getByTestId('profile-delete-account').click();
    await expect(page.getByTestId('delete-confirm')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('delete-confirm')).toBeHidden();
    await expect(page.getByTestId('profile-delete-account')).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('the game pause card traps focus and Escape keeps playing; breathing works without holding', async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    // A slower clock than the games spec's, so a key press of half a second is a real breath.
    await onHome(page, request, uniqueEmail(info, 'game'), 4);
    await page.getByTestId('tab-games').click();
    await page.getByTestId('game-card-breathing').click();
    await page.getByTestId('game-start').click();
    await expect(page.getByTestId('breathing-water')).toBeVisible();

    // Pause: focus goes in and stays; Escape is "keep going".
    await page.getByTestId('game-pause').click();
    await expect(page.getByTestId('game-paused')).toBeVisible();
    await expect.poll(() => focusInside(page, 'game-paused')).toBe(true);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInside(page, 'game-paused')).toBe(true);
    }
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusInside(page, 'game-paused')).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('game-paused')).toBeHidden();
    await expect(page.getByTestId('breathing-water')).toBeVisible();

    // Keyboard: hold Space for a breath (1.5 s of game time at 4x is about 0.4 s).
    const water = page.getByTestId('breathing-water');
    await water.focus();
    await page.keyboard.down('Space');
    await page.waitForTimeout(700);
    await page.keyboard.up('Space');
    await expect(page.getByTestId('breathing-count')).toHaveText('1 breath');

    // Screen reader: a plain activation (no press) breathes in, the next one breathes out.
    await expect(water).toHaveAttribute('aria-pressed', 'false');
    await water.dispatchEvent('click');
    await expect(water).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(700);
    await water.dispatchEvent('click');
    await expect(water).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('breathing-count')).toHaveText('2 breaths');
    // The cue is announced as it changes.
    await expect(page.getByTestId('breathing-cue')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
