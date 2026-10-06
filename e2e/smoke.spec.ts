import { expect, test, type Page } from '@playwright/test';

const STAGES = ['egg', 'hatchling', 'juvenile', 'adult', 'grand'];
const EXPRESSIONS = ['calm', 'happy', 'sleepy', 'excited', 'proud', 'eyesClosed'];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function loadedFonts(page: Page): Promise<string[] & { errors: string[] }> {
  const { loaded, errors } = await page.evaluate(() => ({
    loaded: Array.from(document.fonts)
      .filter((f) => f.status === 'loaded')
      .map((f) => f.family),
    errors: Array.from(document.fonts)
      .filter((f) => f.status === 'error')
      .map((f) => f.family),
  }));
  return Object.assign(loaded, { errors });
}

test.describe('web build', () => {
  test('index shows the croc in the river, the app name and a primary button into the welcome flow', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.getByTestId('app-name')).toHaveText('MHP Hypnose');
    // Faces only report "loaded" once text uses them; the title uses Baloo 2 ExtraBold.
    await page.evaluate(() => document.fonts.ready);
    const fonts = await loadedFonts(page);
    expect(fonts).toContain('Baloo2_800ExtraBold');
    expect(fonts.errors).toEqual([]);

    const croc = page.getByRole('img', { name: /Croc, Stage 3/ });
    await expect(croc).toBeVisible();
    const cta = page.getByTestId('primary-cta');
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    // "Get started" leads into the welcome / account flow.
    await cta.click();
    await expect(page.getByTestId('welcome-screen')).toBeVisible();

    // No horizontal overflow at phone width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
  });

  test('gallery renders all tokens, component states and every croc stage x expression', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/dev/gallery');
    await expect(page.getByTestId('gallery-screen')).toBeVisible();

    for (const id of [
      'colors',
      'type',
      'spacing',
      'buttons',
      'fields',
      'icon-buttons',
      'chips',
      'progress',
      'cards',
      'tabbar',
      'croc',
      'scene',
    ]) {
      const section = page.getByTestId(`gallery-section-${id}`);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
    }

    for (const stage of STAGES) {
      for (const expression of EXPRESSIONS) {
        const croc = page.getByTestId(`croc-${stage}-${expression}`);
        await croc.scrollIntoViewIfNeeded();
        await expect(croc).toBeVisible();
        const box = await croc.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThan(30);
      }
    }

    // Button states behave.
    const presses = page.getByText(/^Presses: /);
    await page.getByTestId('btn-primary').scrollIntoViewIfNeeded();
    await page.getByTestId('btn-primary').click();
    await expect(presses).toHaveText('Presses: 1');
    await page.getByTestId('btn-disabled').click({ force: true });
    await expect(presses).toHaveText('Presses: 1');
    await expect(page.getByTestId('btn-loading')).toHaveAttribute('aria-busy', 'true');
    // Body text (Nunito Sans) is used here, so both families must have loaded.
    await page.evaluate(() => document.fonts.ready);
    const fonts = await loadedFonts(page);
    expect(fonts).toEqual(
      expect.arrayContaining([
        'Baloo2_700Bold',
        'Baloo2_800ExtraBold',
        'NunitoSans_400Regular',
        'NunitoSans_600SemiBold',
      ]),
    );
    expect(fonts.errors).toEqual([]);

    // Tab bar switches.
    await page.getByTestId('gallery-tabbar-games').scrollIntoViewIfNeeded();
    await page.getByTestId('gallery-tabbar-games').click();
    await expect(page.getByTestId('gallery-tabbar-games')).toHaveAttribute('aria-selected', 'true');

    expect(errors).toEqual([]);
  });

  test('gallery switches to Night River and back', async ({ page }) => {
    await page.goto('/dev/gallery');
    const screen = page.getByTestId('gallery-screen');
    const before = await screen.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.getByTestId('gallery-toggle-night').click();
    const after = await screen.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(after).not.toBe(before);
    expect(after).toBe('rgb(8, 23, 26)');
    await page.getByTestId('gallery-toggle-daylight').click();
    await expect
      .poll(() => screen.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe(before);
  });

  async function hasFocusRing(page: Page, testId: string): Promise<boolean> {
    // The focus ring is a child view with a 3px border in the focus colour.
    return page
      .getByTestId(testId)
      .locator('div')
      .evaluateAll((els) => els.some((el) => getComputedStyle(el).borderWidth === '3px'));
  }

  test('keyboard focus shows a visible ring on buttons and tabs, and Space activates a tab', async ({
    page,
  }) => {
    await page.goto('/dev/gallery');
    const btn = page.getByTestId('btn-primary');
    await btn.scrollIntoViewIfNeeded();
    await btn.focus();
    expect(await hasFocusRing(page, 'btn-primary')).toBe(true);

    const tab = page.getByTestId('gallery-tabbar-games');
    await tab.scrollIntoViewIfNeeded();
    await tab.focus();
    expect(await hasFocusRing(page, 'gallery-tabbar-games')).toBe(true);
    await expect(tab).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press(' ');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('gallery-tabbar-croc').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('gallery-tabbar-croc')).toHaveAttribute('aria-selected', 'true');
    // A tap must not leave a ring behind.
    await btn.click();
    expect(await hasFocusRing(page, 'btn-primary')).toBe(false);
  });

  test('long button labels truncate inside the button and the gallery never scrolls sideways', async ({
    page,
  }) => {
    await page.goto('/dev/gallery');
    const long = page.getByTestId('btn-long-label');
    await long.scrollIntoViewIfNeeded();
    const box = await long.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    const overflow = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="gallery-screen"]');
      // Real scroll containers only (overflow auto/scroll); overlays with negative margins are not scrollable.
      const scrollers = Array.from(document.querySelectorAll('div')).filter((d) => {
        const ox = getComputedStyle(d).overflowX;
        return (ox === 'auto' || ox === 'scroll') && d.scrollWidth > d.clientWidth + 1;
      });
      return {
        page: document.documentElement.scrollWidth > window.innerWidth,
        scrollers: scrollers.length,
        found: Boolean(el),
      };
    });
    expect(overflow.found).toBe(true);
    expect(overflow.page).toBe(false);
    expect(overflow.scrollers).toBe(0);
  });

  test('a hug-width button follows its parent alignment', async ({ page }) => {
    await page.goto('/this/does/not/exist');
    const btn = page.getByRole('button', { name: 'Go home' });
    const box = await btn.boundingBox();
    const viewport = page.viewportSize();
    const centre = box!.x + box!.width / 2;
    expect(Math.abs(centre - viewport!.width / 2)).toBeLessThan(4);
  });

  test('reduced motion turns ripples static', async ({ browser }) => {
    const ctx = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await page.goto('/dev/gallery');
    await expect(page.getByTestId('gallery-water-ripples-static')).toBeAttached();
    await expect(page.getByTestId('gallery-water-ripples-animated')).toHaveCount(0);
    // The override toggle can force motion back on for testing.
    await page.getByTestId('gallery-toggle-motion').click();
    await expect(page.getByTestId('gallery-water-ripples-animated')).toBeAttached();
    await ctx.close();
  });

  test('unknown routes show the not-found screen with a way home', async ({ page }) => {
    await page.goto('/this/does/not/exist');
    await expect(page.getByTestId('not-found-screen')).toBeVisible();
    await page.getByRole('button', { name: 'Go home' }).click();
    await expect(page.getByTestId('app-name')).toBeVisible();
  });
});
