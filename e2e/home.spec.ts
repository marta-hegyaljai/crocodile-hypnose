import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// The throwaway account service started by playwright.config.ts.
const API = process.env.E2E_API_URL ?? 'http://localhost:4274';
const PASSWORD = 'river walk 1';

function uniqueEmail(info: TestInfo, tag: string): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `e2e-home-${tag}-${info.project.name}-${id}@example.com`;
}

/** Console errors, minus the browser's own log lines for failed requests (offline on purpose). */
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

/** A user who finished onboarding with the Sleep goal, signed in on home. */
async function onHome(page: Page, request: APIRequestContext, email: string) {
  await page.goto('/sign-up');
  await page.getByTestId('sign-up-name').fill('E2E River');
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
  // The local copies are the fresh account's; drop them so the server's finished ones load.
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

/** Plays a stop from its node: sheet, Start, then the dev "complete" on the session screen. */
async function completeFromMap(page: Page, stopId: string) {
  await page.getByTestId(`stop-${stopId}`).click();
  await page.getByTestId('stop-sheet-start').click();
  await expect(page.getByTestId('session-screen')).toBeVisible();
  await page.getByTestId('session-complete-dev').click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
}

const label = (page: Page, stopId: string) =>
  page.getByTestId(`stop-${stopId}`).getAttribute('aria-label');

test.describe('home and river map', () => {
  test("shows today's session, explains locks, and completing a stop moves the croc", async ({
    page,
    request,
  }, info) => {
    const errors = collectErrors(page);
    const headers = await onHome(page, request, uniqueEmail(info, 'map'));

    // Today's session: the first stop of the goal zone, one tap to play.
    await expect(page.getByTestId('today-title')).toHaveText('Sleep · Stop 1');
    await expect(page.getByTestId('home-greeting')).toHaveText('Hi, E2E River');
    await expect(page.getByTestId('home-points')).toContainText('50');
    await expect(page.getByTestId('home-weekly')).toContainText('0/5');
    await expect(page.getByTestId('stop-sleep-1')).toBeInViewport();
    expect(await label(page, 'sleep-1')).toContain('You are here');

    // A locked stop says why.
    await page.getByTestId('stop-sleep-3').click();
    await expect(page.getByTestId('stop-sheet-message')).toHaveText(
      'Finish Sleep · Stop 2 first to unlock this stop.',
    );
    await expect(page.getByTestId('stop-sheet-start')).toHaveCount(0);
    await page.getByTestId('stop-sheet-close').click();
    await expect(page.getByTestId('stop-sheet')).toHaveCount(0);

    // Play today's session and finish it (dev helper): the next stop unlocks, the croc moves.
    const crocBefore = await page.getByTestId('map-croc').boundingBox();
    await page.getByTestId('today-play').click();
    await expect(page.getByTestId('session-title')).toHaveText('Sleep · Stop 1');
    await page.getByTestId('session-complete-dev').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('today-title')).toHaveText('Sleep · Stop 2');
    await expect.poll(() => label(page, 'sleep-1')).toContain('Done');
    await expect.poll(() => label(page, 'sleep-2')).toContain('You are here');
    await expect(page.getByTestId('home-weekly')).toContainText('1/5');
    await expect
      .poll(async () => {
        const croc = await page.getByTestId('map-croc').boundingBox();
        const node = await page.getByTestId('stop-sleep-2').boundingBox();
        return croc && node && crocBefore
          ? Math.abs(croc.y + 34 - node.y - node.height / 2) < 60
          : false;
      })
      .toBe(true);

    // The stop that was locked can be started now.
    await page.getByTestId('stop-sleep-2').click();
    await expect(page.getByTestId('stop-sheet-start')).toBeVisible();
    await page.getByTestId('stop-sheet-close').click();

    // Progress reached the server, and survives a reload.
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/me/progress`, { headers });
        const body = (await res.json()) as {
          progress: { stops: Record<string, { status: string }> } | null;
        };
        return body.progress?.stops['sleep-1']?.status;
      })
      .toBe('done');
    await page.reload();
    await expect(page.getByTestId('today-title')).toHaveText('Sleep · Stop 2');

    // The other tabs are there (placeholders until later steps).
    await page.getByTestId('tab-games').click();
    await expect(page.getByTestId('games-screen')).toBeVisible();
    await page.getByTestId('tab-home').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('works offline and syncs when back online', async ({ page, context, request }, info) => {
    const headers = await onHome(page, request, uniqueEmail(info, 'offline'));
    await context.setOffline(true);
    await completeFromMap(page, 'sleep-1');
    await completeFromMap(page, 'sleep-2');
    await expect(page.getByTestId('today-title')).toHaveText('Sleep · Stop 3');
    await expect(page.getByTestId('home-sync-pending')).toBeVisible();
    const stored = async () => {
      const res = await request.get(`${API}/me/progress`, { headers });
      const body = (await res.json()) as { progress: { stops: Record<string, unknown> } | null };
      return Object.keys(body.progress?.stops ?? {}).sort();
    };
    expect(await stored()).toEqual([]);

    await context.setOffline(false);
    await expect.poll(stored).toEqual(['sleep-1', 'sleep-2']);
    await expect(page.getByTestId('home-sync-pending')).toHaveCount(0);
  });
});
