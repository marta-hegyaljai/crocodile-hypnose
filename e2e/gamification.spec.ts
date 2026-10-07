import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// The throwaway account service started by playwright.config.ts (with DEV_HOOKS=1).
const API = process.env.E2E_API_URL ?? 'http://localhost:4274';
const PASSWORD = 'river walk 1';
/** The games run this many times faster (dev-build hook, see src/features/games/clock.ts). */
const FAST = 40;

function uniqueEmail(info: TestInfo, tag: string): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `e2e-gami-${tag}-${info.project.name}-${id}@example.com`;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    // Offline on purpose: the browser's own lines for requests and media that cannot load.
    if (
      msg.type() === 'error' &&
      !msg.text().startsWith('Failed to load resource') &&
      !msg.text().startsWith('Failed to load because no supported source')
    ) {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    // The session's media cannot load while offline on purpose (the player's own business).
    if (!err.message.startsWith('Failed to load because no supported source')) {
      errors.push(err.message);
    }
  });
  return errors;
}

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API}/auth/signin`, {
    data: { email, password: PASSWORD, clientId: 'mhp-hypnose' },
  });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { tokens: { accessToken: string } }).tokens.accessToken;
}

/** A user who finished onboarding (Sleep goal, medium sessions), signed in on home. */
async function onHome(page: Page, request: APIRequestContext, email: string) {
  await page.addInitScript((s) => {
    (window as unknown as { __mhpTimeScale: number }).__mhpTimeScale = s;
  }, FAST);
  await page.goto('/sign-up');
  await page.getByTestId('sign-up-name').fill('E2E Lagoon');
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

interface Points {
  balance: number;
  calmSeconds: number;
  badges: { id: string }[];
  owned: { itemId: string }[];
}

const pointsOf = async (request: APIRequestContext, headers: Record<string, string>) =>
  ((await (await request.get(`${API}/me/points`, { headers })).json()) as { points: Points })
    .points;

test.describe('gamification', () => {
  test('sessions and games earn points on the server; growth, decorations, goal and badges', async ({
    page,
    request,
  }, info) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    const headers = await onHome(page, request, uniqueEmail(info, 'all'));

    // The onboarding reward, from the server's ledger; the weekly goal from the timing (medium: 4).
    await expect(page.getByTestId('home-points')).toContainText('50');
    await expect(page.getByTestId('home-weekly')).toContainText('0/4');

    // A session: 10 + 20 first time + 15 for the first-session scale.
    await page.getByTestId('today-play').click();
    await expect(page.getByTestId('session-screen')).toBeVisible();
    await page.getByTestId('session-complete-dev').click();
    await page.getByTestId('session-reward-continue').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('home-points')).toContainText('95');
    await expect(page.getByTestId('home-weekly')).toContainText('1/4');
    await expect.poll(async () => (await pointsOf(request, headers)).balance).toBe(95);

    // Replays and crafted requests earn nothing extra: the same event again, a claimed long
    // trance with a first-time bonus for a finished video stop, and a stop that does not exist.
    const events = (
      (await (await request.get(`${API}/me/events`, { headers })).json()) as {
        events: Record<string, unknown>[];
      }
    ).events;
    expect(events).toHaveLength(1);
    const { storedAt: _storedAt, ...stored } = events[0]!;
    const replay = await request.post(`${API}/me/events`, {
      headers,
      data: {
        events: [
          stored,
          { ...stored, id: 'crafted-0001', stopType: 'longTrance', firstTime: true },
          { ...stored, id: 'crafted-0002', stopId: 'nowhere-1' },
        ],
      },
    });
    expect(replay.status()).toBe(200);
    // Only the second (real) completion of the video stop pays its base 10.
    await expect.poll(async () => (await pointsOf(request, headers)).balance).toBe(105);
    expect((await (await request.get(`${API}/me/events`, { headers })).json()).events.length).toBe(
      3,
    );

    // A game: 5 points and the breathing scale.
    await page.getByTestId('tab-games').click();
    await page.getByTestId('game-card-breathing').click();
    await page.getByTestId('game-start').click();
    // A round only counts with some play in it: two held breaths (1.5 s of game time each).
    await expect(page.getByTestId('breathing-water')).toBeVisible();
    for (let i = 0; i < 2; i++) {
      const box = await page.getByTestId('breathing-water').boundingBox();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(140);
      await page.mouse.up();
      await page.waitForTimeout(60);
    }
    await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('game-done').click();
    await expect(page.getByTestId('games-screen')).toBeVisible();
    await expect.poll(async () => (await pointsOf(request, headers)).balance).toBe(125);
    const afterGame = await pointsOf(request, headers);
    expect(afterGame.badges.map((b) => b.id).sort()).toEqual(['firstBreathing', 'firstSession']);

    // Growth: 30 calm minutes (dev hook) reach the next stage; the moment shows once on home.
    const calm = await request.post(`${API}/me/dev/calm`, { headers, data: { seconds: 1800 } });
    expect(calm.status()).toBe(200);
    await page.getByTestId('tab-home').click();
    await page.reload();
    await expect(page.getByTestId('growth-moment')).toBeVisible();
    await expect(page.getByTestId('growth-stage')).toHaveText('Stage 3');
    await page.screenshot({ path: test.info().outputPath('growth.png') });
    await page.getByTestId('growth-continue').click();
    await expect(page.getByTestId('growth-moment')).toHaveCount(0);
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/me/gamification`, { headers });
        return ((await res.json()) as { gamification: { seenStage: string } | null }).gamification
          ?.seenStage;
      })
      .toBe('juvenile');
    await page.reload();
    await expect(page.getByTestId('home-points')).toContainText('125');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('growth-moment')).toHaveCount(0);

    // The habitat: buy lily pads (40) and they are placed; the first-decoration scale follows.
    await page.getByTestId('tab-croc').click();
    await expect(page.getByTestId('croc-screen')).toBeVisible();
    await expect(page.getByTestId('habitat-stage')).toHaveText('Stage 3');
    await expect(page.getByTestId('badge-firstSession-earned')).toBeVisible();
    await expect(page.getByTestId('item-waterfall-buy')).toBeDisabled();
    await page.getByTestId('item-lilyPads-buy').click();
    await expect(page.getByTestId('item-lilyPads-remove')).toBeVisible();
    await expect(page.getByTestId('habitat-scene-item-lilyPads')).toBeAttached();
    await expect(page.getByTestId('badge-firstDecoration-earned')).toBeAttached();
    await expect(page.getByTestId('habitat-points')).toContainText('100');
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/me/habitat`, { headers });
        const body = (await res.json()) as {
          habitat: { slots: Record<string, string | null> } | null;
        };
        return body.habitat?.slots['water-left'];
      })
      .toBe('lilyPads');
    // Buying again (another tab, a retry) costs nothing.
    const again = await request.post(`${API}/me/habitat/purchases`, {
      headers,
      data: { itemId: 'lilyPads' },
    });
    expect(((await again.json()) as { points: Points }).points.balance).toBe(100);
    // Crafted: a decoration that is still locked, and one that costs more than the balance.
    expect(
      (
        await request.post(`${API}/me/habitat/purchases`, { headers, data: { itemId: 'turtle' } })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post(`${API}/me/habitat/purchases`, {
          headers,
          data: { itemId: 'waterfall' },
        })
      ).status(),
    ).toBe(409);

    // The weekly goal: down to 3 days; the server keeps it.
    await page.getByTestId('weekly-less').click();
    await expect(page.getByTestId('weekly-target')).toContainText('3');
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/me/gamification`, { headers });
        return ((await res.json()) as { gamification: { weeklyTarget: number } | null })
          .gamification?.weeklyTarget;
      })
      .toBe(3);
    await page.screenshot({ path: test.info().outputPath('habitat.png'), fullPage: true });
    // After a reload everything comes back from the server.
    await page.reload();
    await expect(page.getByTestId('item-lilyPads-remove')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('offline: a finished session shows as pending points and is paid once back online', async ({
    page,
    request,
    context,
  }, info) => {
    const errors = collectErrors(page);
    const headers = await onHome(page, request, uniqueEmail(info, 'offline'));
    await expect(page.getByTestId('home-points')).toContainText('50');
    await context.setOffline(true);
    await page.getByTestId('today-play').click();
    await page.getByTestId('session-complete-dev').click();
    await page.getByTestId('session-reward-continue').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    // The server's 50 plus the 30 the session is expected to earn.
    await expect(page.getByTestId('home-points')).toContainText('50 +30');
    await expect(page.getByTestId('home-weekly')).toContainText('1/4');
    await context.setOffline(false);
    await expect(page.getByTestId('home-points')).toContainText('95', { timeout: 15_000 });
    expect((await pointsOf(request, headers)).balance).toBe(95);
    expect(errors).toEqual([]);
  });
});
