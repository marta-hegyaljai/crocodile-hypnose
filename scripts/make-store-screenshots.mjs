#!/usr/bin/env node
/**
 * Store screenshots from the real app (step 9b).
 *
 * Captures five moments per platform with Playwright Chromium at the device's logical size and
 * deviceScaleFactor, so the raw frames are exactly the store pixel sizes:
 *
 *   iOS 6.9"  1320x2868 = 440x956 @3     -> assets/store/ios/
 *   Android   1080x2400 =  360x800 @3     -> assets/store/android/
 *
 * Each platform folder holds `raw/` (the full-bleed frames as shot) and five framed shots
 * `01-river-map.png` ... `05-habitat.png`: the frame on a branded background with a caption
 * placeholder ("[Caption N]", no marketing copy). A contact sheet goes to
 * docs/build/screenshots/design/step-09/store-contact-sheet.png.
 *
 * Needs a running dev stack with DEV_HOOKS=1 and dev mode OFF in the web export:
 *
 *   DEV_HOOKS=1 PORT=4960 DB_PATH=/tmp/s09-store/dev.sqlite CORS_ORIGINS=http://localhost:4961 \
 *     npm --prefix server run dev
 *   npx cross-env EXPO_PUBLIC_DEV_MODE=0 EXPO_PUBLIC_API_URL=http://localhost:4960 \
 *     npx expo export --platform web --output-dir /tmp/s09-store/web --clear
 *   npx serve /tmp/s09-store/web --listen 4961 --single
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/make-store-screenshots.mjs \
 *     [--web http://localhost:4961] [--api http://localhost:4960] [--only ios|android] [--compose-only]
 *
 * State is seeded through the API the way e2e/gamification.spec.ts does (onboarding + settings
 * documents, `POST /me/dev/calm` for growth), on throwaway accounts created per run.
 */
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, request as pwRequest } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const WEB = flag('--web', 'http://localhost:4961');
const API = flag('--api', 'http://localhost:4960');
const ONLY = flag('--only', null);
const COMPOSE_ONLY = args.includes('--compose-only');
const PASSWORD = 'river walk 1';

const PLATFORMS = {
  ios: { width: 440, height: 956, scale: 3, label: 'iPhone 6.9" 1320x2868', frameRadius: 60 },
  android: { width: 360, height: 800, scale: 3, label: 'Android 1080x2400', frameRadius: 40 },
};

const SHOTS = [
  { file: '01-river-map', what: 'Home: the river map with the croc as hero' },
  { file: '02-hatching', what: 'Onboarding: the hatching moment' },
  { file: '03-night-river', what: 'Session: Night River trance player' },
  { file: '04-mini-game', what: 'Mini-game: Breathing (holding the water)' },
  { file: '05-habitat', what: 'Croc tab: the habitat after a growth moment' },
];

const palette = {
  deepJungle: '#0E2E24',
  riverTeal: '#1D6E6A',
  shallows: '#7CC4B5',
  amber: '#F2A93B',
  riverMist: '#E7F0E6',
  nightRiver: '#08171A',
  jungleInk: '#0E1A12',
  mistLight: '#F6FAF4',
};

const uniq = (tag) =>
  `store-${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;

async function signIn(api, email) {
  const res = await api.post(`${API}/auth/signin`, {
    data: { email, password: PASSWORD, clientId: 'mhp-hypnose' },
  });
  if (res.status() !== 200) throw new Error(`signin ${res.status()}`);
  return { authorization: `Bearer ${(await res.json()).tokens.accessToken}` };
}

async function signUp(page, email, name) {
  await page.goto(`${WEB}/sign-up`);
  await page.getByTestId('sign-up-name').fill(name);
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill(PASSWORD);
  await page.getByTestId('sign-up-submit').click();
  await page.getByTestId('onboarding-goals').waitFor();
}

async function dropLocal(page) {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('mhp.hypnose.') && !key.startsWith('mhp.hypnose.session')) {
        localStorage.removeItem(key);
      }
    }
  });
}

function onboardingDoc(now, overrides) {
  return {
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
    ...overrides,
  };
}

async function put(api, headers, kind, data) {
  const res = await api.put(`${API}/me/${kind}`, { headers, data });
  if (res.status() !== 200) throw new Error(`PUT /me/${kind} ${res.status()} ${await res.text()}`);
}

/** Lets entrance animations settle before a frame. */
const settle = (page, ms = 1600) => page.waitForTimeout(ms);

async function captureRaw(platform, spec, outDir) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: spec.scale,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
    locale: 'en-GB',
  });
  const api = await pwRequest.newContext();
  const shot = (name) =>
    context.pages()[0].screenshot({ path: join(outDir, `${name}.png`), animations: 'allow' });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  // --- 02 hatching: a fresh account parked on the hatch step.
  {
    const email = uniq(`hatch-${platform}`);
    await signUp(page, email, 'Store Hatch');
    const headers = await signIn(api, email);
    const now = Date.now();
    await put(
      api,
      headers,
      'onboarding',
      onboardingDoc(now, {
        step: 'hatch',
        completed: false,
        completedAt: null,
        crocHatched: false,
        crocName: null,
        firstSession: { completed: false, moodBefore: null, moodAfter: null },
        reminder: null,
        rewardGranted: false,
      }),
    );
    await dropLocal(page);
    await page.goto(`${WEB}/onboarding/hatch`);
    await page.getByTestId('onboarding-hatch').waitFor();
    await settle(page);
    const egg = page.getByTestId('hatch-egg');
    for (let i = 0; i < 3; i++) {
      await egg.click();
      await page.waitForTimeout(260);
    }
    await page.getByTestId('hatch-done').waitFor();
    await page.waitForTimeout(900);
    await shot('02-hatching');
    // Sign this account out of the browser so the next one starts clean.
    await page.evaluate(() => localStorage.clear());
  }

  // --- The main account: onboarding done, one session and one game played, grown to stage 3.
  const email = uniq(`main-${platform}`);
  await signUp(page, email, 'Store Lagoon');
  const headers = await signIn(api, email);
  const now = Date.now();
  // No goal zone yet, so today's stop is deterministic: Intro stop 2, an audio stop (the Night
  // River player with the croc), and the map croc sits near the top of the river.
  await put(api, headers, 'onboarding', onboardingDoc(now, { goals: [] }));
  await put(api, headers, 'settings', {
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
  // The first stop already done so the map shows a journey under way.
  await put(api, headers, 'progress', {
    version: 1,
    updatedAt: now,
    stops: Object.fromEntries(
      ['intro-1'].map((id) => [
        id,
        { status: 'done', updatedAt: now - 1000, completedAt: now - 1000 },
      ]),
    ),
  });
  await dropLocal(page);
  await page.goto(`${WEB}/`);
  await page.getByTestId('home-screen').waitFor();
  await settle(page, 2200);
  await shot('01-river-map');

  // --- 03 Night River: open today's stop and start it; the player is the night scene.
  await page.getByTestId('today-play').click();
  await page.getByTestId('session-screen').waitFor();
  await settle(page, 1200);
  await page.getByTestId('session-start').click();
  const skip = page.getByTestId('mood-before-skip');
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.getByTestId('session-player').waitFor();
  await settle(page, 3200);
  await shot('03-night-river');
  await page.goto(`${WEB}/`);
  await page.getByTestId('home-screen').waitFor();

  // --- 04 mini-game: Breathing, mid-hold so the water is drawn in.
  await page.getByTestId('tab-games').click();
  await page.getByTestId('games-screen').waitFor();
  await page.getByTestId('game-card-breathing').click();
  await page.getByTestId('game-start').click();
  const water = page.getByTestId('breathing-water');
  await water.waitFor();
  await settle(page, 900);
  const box = await water.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await shot('04-mini-game');
  await page.mouse.up();
  await page.goto(`${WEB}/`);
  await page.getByTestId('home-screen').waitFor();

  // --- 05 habitat: 30 calm minutes (dev hook), the growth moment, then the habitat with a lily pad.
  const calm = await api.post(`${API}/me/dev/calm`, { headers, data: { seconds: 1800 } });
  if (calm.status() !== 200) throw new Error(`dev/calm ${calm.status()}`);
  await page.reload();
  await page.getByTestId('growth-moment').waitFor();
  await settle(page, 2400);
  await shot('05a-growth-moment');
  await page.getByTestId('growth-continue').click();
  await page.getByTestId('tab-croc').click();
  await page.getByTestId('croc-screen').waitFor();
  const buy = page.getByTestId('item-lilyPads-buy');
  if (await buy.isVisible().catch(() => false)) {
    await buy.click();
    await page.getByTestId('item-lilyPads-remove').waitFor();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 1800);
  await shot('05-habitat');

  await api.dispose();
  await browser.close();
}

/** The app's own faces (src/theme/fonts.ts) for the caption placeholder, as data URLs. */
const fontFace = (family, weight, file) =>
  `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(join(root, 'node_modules/@expo-google-fonts', file)).toString('base64')}) format("truetype")}`;
const FONT_CSS = [
  fontFace('Baloo 2', 800, 'baloo-2/800ExtraBold/Baloo2_800ExtraBold.ttf'),
  fontFace('Nunito Sans', 600, 'nunito-sans/600SemiBold/NunitoSans_600SemiBold.ttf'),
].join('\n');

/** A framed store shot: the raw frame on a branded gradient with a caption placeholder. */
function frameHtml(platform, spec, index, rawPath) {
  const W = spec.width * spec.scale;
  const H = spec.height * spec.scale;
  const night = index === 2; // the Night River shot sits on a night background
  const bg = night
    ? `linear-gradient(180deg, ${palette.nightRiver} 0%, #0E2328 55%, ${palette.deepJungle} 100%)`
    : `linear-gradient(180deg, ${palette.riverMist} 0%, #CFE0D2 45%, ${palette.shallows} 100%)`;
  const captionColor = night ? palette.mistLight : palette.deepJungle;
  const captionTop = Math.round(H * 0.055);
  const frameTop = Math.round(H * 0.2);
  const frameH = Math.round(H * 0.76);
  const frameW = Math.round((frameH / H) * W);
  const bezel = Math.round(W * 0.012);
  const r = spec.frameRadius * spec.scale * 0.8;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${FONT_CSS}
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
  body{background:${bg};font-family:"Nunito Sans",system-ui,sans-serif;position:relative}
  .caption{position:absolute;top:${captionTop}px;left:0;right:0;text-align:center;padding:0 ${Math.round(W * 0.08)}px;color:${captionColor}}
  .caption .ph{display:inline-block;font-family:"Baloo 2",system-ui,sans-serif;font-weight:800;font-size:${Math.round(W * 0.068)}px;line-height:1.15;letter-spacing:-0.01em;
    border:${Math.round(W * 0.004)}px dashed ${night ? 'rgba(246,250,244,0.55)' : 'rgba(14,46,36,0.45)'};border-radius:${Math.round(W * 0.03)}px;
    padding:${Math.round(W * 0.025)}px ${Math.round(W * 0.05)}px}
  .caption .note{margin-top:${Math.round(W * 0.018)}px;font-size:${Math.round(W * 0.026)}px;font-weight:600;opacity:0.7}
  .device{position:absolute;top:${frameTop}px;left:${Math.round((W - frameW) / 2 - bezel)}px;width:${frameW + bezel * 2}px;height:${frameH + bezel * 2}px;
    background:${palette.jungleInk};border-radius:${r + bezel}px;box-shadow:0 ${Math.round(W * 0.04)}px ${Math.round(W * 0.12)}px rgba(14,26,18,0.35)}
  .screen{position:absolute;top:${bezel}px;left:${bezel}px;width:${frameW}px;height:${frameH}px;border-radius:${r}px;overflow:hidden;background:#000}
  .screen img{display:block;width:100%;height:100%}
  .leaf{position:absolute;border-radius:50% 50% 50% 0;transform:rotate(-20deg);opacity:0.18;background:${palette.deepJungle}}
  </style></head><body>
  <div class="leaf" style="width:${W * 0.5}px;height:${W * 0.5}px;left:${-W * 0.2}px;bottom:${-W * 0.12}px;background:${night ? palette.riverTeal : palette.deepJungle}"></div>
  <div class="leaf" style="width:${W * 0.36}px;height:${W * 0.36}px;right:${-W * 0.14}px;top:${H * 0.1}px;transform:rotate(140deg);background:${night ? palette.riverTeal : palette.deepJungle}"></div>
  <div class="caption"><span class="ph">[Caption ${index + 1}]</span><div class="note">placeholder: no copy yet</div></div>
  <div class="device"><div class="screen"><img src="data:image/png;base64,${readFileSync(rawPath).toString('base64')}" alt=""></div></div>
  </body></html>`;
}

async function compose(platform, spec, rawDir, outDir, browser) {
  const page = await browser.newPage({
    viewport: { width: spec.width * spec.scale, height: spec.height * spec.scale },
    deviceScaleFactor: 1,
  });
  for (const [i, s] of SHOTS.entries()) {
    const raw = join(rawDir, `${s.file}.png`);
    if (!existsSync(raw)) throw new Error(`missing raw frame ${raw}`);
    await page.setContent(frameHtml(platform, spec, i, raw), { waitUntil: 'load' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(outDir, `${s.file}.png`) });
  }
  await page.close();
}

async function contactSheet(browser, outPath) {
  const cell = 220;
  const rows = Object.entries(PLATFORMS)
    .filter(([platform]) =>
      existsSync(join(root, 'assets/store', platform, `${SHOTS[0].file}.png`)),
    )
    .map(([platform, spec]) => {
      const h = Math.round(cell * (spec.height / spec.width));
      const imgs = SHOTS.map(
        (s) =>
          `<figure><img src="data:image/png;base64,${readFileSync(join(root, 'assets/store', platform, `${s.file}.png`)).toString('base64')}" style="width:${cell}px;height:${h}px"><figcaption>${s.file}</figcaption></figure>`,
      ).join('');
      return `<section><h2>${platform} · ${spec.label}</h2><div class="row">${imgs}</div></section>`;
    });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:28px;background:${palette.mistLight};font-family:system-ui,sans-serif;color:${palette.deepJungle};width:${cell * 5 + 16 * 4 + 56}px}
  h1{font-size:22px;margin:0 0 6px}p{margin:0 0 20px;font-size:13px;opacity:.75}
  h2{font-size:14px;margin:18px 0 10px;text-transform:uppercase;letter-spacing:.08em}
  .row{display:flex;gap:16px}figure{margin:0}img{display:block;border-radius:10px;box-shadow:0 6px 18px rgba(14,46,36,.18)}
  figcaption{font-size:11px;margin-top:6px;text-align:center;opacity:.7}
  </style></head><body><h1>MHP Hypnose · store screenshots (step 9b)</h1>
  <p>Framed shots from the real app, dev mode off. Captions are placeholders. Regenerate: scripts/make-store-screenshots.mjs</p>
  ${rows.join('')}</body></html>`;
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1200 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: outPath, fullPage: true });
  await page.close();
}

const platforms = Object.entries(PLATFORMS).filter(([p]) => !ONLY || p === ONLY);
for (const [platform, spec] of platforms) {
  const outDir = join(root, 'assets/store', platform);
  const rawDir = join(outDir, 'raw');
  mkdirSync(rawDir, { recursive: true });
  if (!COMPOSE_ONLY) {
    console.log(`capturing ${platform} (${spec.label}) from ${WEB}`);
    await captureRaw(platform, spec, rawDir);
  }
}
const browser = await chromium.launch();
for (const [platform, spec] of platforms) {
  const outDir = join(root, 'assets/store', platform);
  console.log(`composing ${platform}`);
  await compose(platform, spec, join(outDir, 'raw'), outDir, browser);
}
const sheetDir = join(root, 'docs/build/screenshots/design/step-09');
mkdirSync(sheetDir, { recursive: true });
await contactSheet(browser, join(sheetDir, 'store-contact-sheet.png'));
await browser.close();
console.log('done');
