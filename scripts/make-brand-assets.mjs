#!/usr/bin/env node
/**
 * Builds the app identity assets from one SVG mark: the croc peeking out of the river, the amber
 * slit eye as the signature.
 *
 *   node scripts/make-brand-assets.mjs            # writes assets/brand/*.svg and the PNGs in assets/
 *   node scripts/make-brand-assets.mjs --preview  # also renders a contact sheet (icon at 16..180,
 *                                                 # light/dark, the adaptive layers and the splash)
 *                                                 # to docs/build/screenshots/design/step-09/
 *
 * Outputs (all referenced from app.json):
 *   assets/icon.png                       1024, iOS / generic app icon (full bleed, the OS rounds it)
 *   assets/android-icon-foreground.png    1024, adaptive foreground (mark inside the 66% safe circle)
 *   assets/android-icon-background.png    1024, adaptive background (Deep Jungle)
 *   assets/android-icon-monochrome.png    1024, themed-icon alpha silhouette
 *   assets/splash-icon.png                1024, the mark on transparent, shown 200pt wide on River Mist
 *   assets/favicon.png                    48, the icon in a pebble mask
 *
 * The PNGs are rendered with the Playwright Chromium already used by the e2e suite (no extra
 * dependency). Colours come from src/theme/palette.ts; they are repeated here because this script
 * runs under plain Node.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const brand = join(assets, 'brand');
const previewDir = join(root, 'docs/build/screenshots/design/step-09');
const preview = process.argv.includes('--preview');

// src/theme/palette.ts and src/illustration/croc/colors.ts (daylight croc).
const palette = {
  deepJungle: '#0E2E24',
  jungleGlow: '#1C5241',
  jungleInk: '#0E1A12',
  crocGreen: '#3F6B35',
  crocSkin: '#4F8040',
  crocScute: '#2E5229',
  skinTop: '#49783C',
  skinShade: '#376030',
  riverTeal: '#1D6E6A',
  tealDeep: '#17524F',
  shallows: '#7CC4B5',
  amberLight: '#FFD57A',
  amber: '#F2A93B',
  amberDeep: '#B8701A',
  riverMist: '#E7F0E6',
  white: '#FFFFFF',
};

const SIZE = 1024;
const WATER_Y = 624;

/** Gradient and clip definitions shared by the coloured variants. */
function defs(id) {
  return `<defs>
  <radialGradient id="${id}-sky" cx="700" cy="180" r="900" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${palette.jungleGlow}"/>
    <stop offset="0.55" stop-color="${palette.deepJungle}"/>
    <stop offset="1" stop-color="#0A241C"/>
  </radialGradient>
  <linearGradient id="${id}-water" x1="0" y1="${WATER_Y}" x2="0" y2="${SIZE}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${palette.riverTeal}"/>
    <stop offset="1" stop-color="${palette.tealDeep}"/>
  </linearGradient>
  <linearGradient id="${id}-skin" x1="0" y1="250" x2="0" y2="${WATER_Y + 30}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${palette.skinTop}"/>
    <stop offset="0.55" stop-color="${palette.crocGreen}"/>
    <stop offset="1" stop-color="${palette.skinShade}"/>
  </linearGradient>
  <radialGradient id="${id}-eye" cx="574" cy="386" r="134" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${palette.amberLight}"/>
    <stop offset="0.65" stop-color="${palette.amber}"/>
    <stop offset="1" stop-color="${palette.amberDeep}"/>
  </radialGradient>
  <radialGradient id="${id}-glow" cx="574" cy="404" r="260" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${palette.amber}" stop-opacity="0.28"/>
    <stop offset="1" stop-color="${palette.amber}" stop-opacity="0"/>
  </radialGradient>
</defs>`;
}

/** Deep Jungle sky with two soft leaf shadows in the corners. */
function sky(id) {
  return `<rect width="${SIZE}" height="${SIZE}" fill="url(#${id}-sky)"/>
<path d="M -40 300 C 60 120 240 60 420 110 C 300 150 170 250 120 420 C 90 360 20 340 -40 300 Z" fill="${palette.jungleInk}" opacity="0.28"/>
<path d="M 1070 120 C 980 70 860 90 790 180 C 880 170 950 210 1010 300 C 1030 230 1050 170 1070 120 Z" fill="${palette.jungleInk}" opacity="0.22"/>`;
}

/** The river: a soft top wave, the body of water and two ripples around the head. */
function water(id, { full = true } = {}) {
  const wave = `M -20 ${WATER_Y} q 90 -26 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0`;
  const body = full
    ? `<path d="${wave} L 1044 ${SIZE + 20} L -20 ${SIZE + 20} Z" fill="url(#${id}-water)"/>`
    : '';
  return `${body}
<ellipse cx="540" cy="${WATER_Y + 62}" rx="340" ry="44" fill="${palette.jungleInk}" opacity="0.2"/>
<path d="${wave}" fill="none" stroke="${palette.shallows}" stroke-width="10" stroke-linecap="round" opacity="0.85"/>
<path d="M 150 ${WATER_Y + 118} q 70 -22 140 0" fill="none" stroke="${palette.shallows}" stroke-width="9" stroke-linecap="round" opacity="0.45"/>
<path d="M 790 ${WATER_Y + 150} q 70 -22 140 0" fill="none" stroke="${palette.shallows}" stroke-width="9" stroke-linecap="round" opacity="0.4"/>`;
}

/** The croc's head above the water line, eye socket bump, the amber slit eye. */
function head(id) {
  const outline = [
    `M 176 ${WATER_Y + 40}`,
    'C 160 500 236 352 410 322',
    'C 470 310 548 306 630 340',
    'C 700 370 760 420 830 470',
    'C 880 486 930 500 952 530',
    `C 968 552 964 596 944 ${WATER_Y + 24}`,
    `L 930 ${WATER_Y + 46}`,
    'Z',
  ].join(' ');
  return `<ellipse cx="574" cy="404" rx="260" ry="250" fill="url(#${id}-glow)"/>
<path d="${outline}" fill="url(#${id}-skin)"/>
<path d="M 300 350 l 26 -40 l 30 32 Z" fill="${palette.crocScute}" opacity="0.8"/>
<path d="M 362 324 l 30 -44 l 34 32 Z" fill="${palette.crocScute}" opacity="0.8"/>
<ellipse cx="566" cy="370" rx="158" ry="130" fill="${palette.crocSkin}"/>
<ellipse cx="906" cy="522" rx="17" ry="12" fill="${palette.crocScute}" opacity="0.85"/>
<path d="M 700 388 C 780 410 860 452 930 500" fill="none" stroke="${palette.crocScute}" stroke-width="7" stroke-linecap="round" opacity="0.35"/>
<circle cx="574" cy="404" r="124" fill="url(#${id}-eye)" stroke="${palette.crocScute}" stroke-width="9"/>
<ellipse cx="588" cy="404" rx="22" ry="94" fill="${palette.jungleInk}"/>
<circle cx="624" cy="352" r="26" fill="${palette.white}" opacity="0.95"/>
<circle cx="527" cy="456" r="12" fill="${palette.white}" opacity="0.6"/>
<path d="M 474 330 A 128 128 0 0 1 674 330 Q 574 318 474 330 Z" fill="${palette.crocSkin}"/>
<path d="M 474 330 A 128 128 0 0 1 674 330" fill="none" stroke="${palette.crocScute}" stroke-width="9" stroke-linecap="round"/>`;
}

function svg(body, { viewBox = `0 0 ${SIZE} ${SIZE}`, width = SIZE, height = SIZE } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">\n${body}\n</svg>\n`;
}

/** The full icon: sky, head, water. */
function iconSvg() {
  const id = 'icon';
  return svg(`${defs(id)}\n${sky(id)}\n${head(id)}\n${water(id)}`);
}

/** Adaptive foreground: the mark scaled to the 66% safe circle on a transparent canvas. */
function foregroundSvg() {
  const id = 'fg';
  const s = 0.74;
  const tx = (SIZE - SIZE * s) / 2;
  const ty = tx + 18;
  const body = `${head(id)}\n${water(id)}`;
  return svg(
    `${defs(id)}\n<clipPath id="${id}-circle"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE * 0.5}"/></clipPath>\n<g transform="translate(${tx} ${ty}) scale(${s})">${body}</g>`,
  );
}

function backgroundSvg() {
  const id = 'bg';
  return svg(`${defs(id)}\n${sky(id)}`);
}

/** Themed icon: one alpha silhouette. Head with the eye cut out (the slit left in), water wave. */
function monochromeSvg() {
  const s = 0.66;
  const tx = (SIZE - SIZE * s) / 2;
  const ty = tx + 40;
  const outline =
    'M 176 664 C 160 500 236 352 410 322 C 470 310 548 306 630 340 C 700 370 760 420 830 470 C 880 486 930 500 952 530 C 968 552 964 596 944 648 L 930 670 Z';
  const eyeHole = 'M 450 404 a 124 124 0 1 0 248 0 a 124 124 0 1 0 -248 0 Z';
  const wave = `M 60 ${WATER_Y + 110} q 90 -30 180 0 t 180 0 t 180 0 t 180 0 t 180 0`;
  return svg(
    `<g transform="translate(${tx} ${ty}) scale(${s})" fill="#000">
<path d="${outline} ${eyeHole}" fill-rule="evenodd"/>
<ellipse cx="588" cy="404" rx="30" ry="96"/>
<path d="${wave}" fill="none" stroke="#000" stroke-width="44" stroke-linecap="round"/>
</g>`,
  );
}

/** Splash mark: the icon in a pebble mask (28% radius), on transparent. Shown on River Mist. */
function splashSvg() {
  const id = 'splash';
  const r = Math.round(SIZE * 0.26);
  return svg(
    `${defs(id)}\n<clipPath id="${id}-pebble"><rect width="${SIZE}" height="${SIZE}" rx="${r}"/></clipPath>\n<g clip-path="url(#${id}-pebble)">${sky(id)}\n${head(id)}\n${water(id)}</g>`,
  );
}

/** Favicon: the icon in a pebble mask so it reads as a tile on any tab strip. */
function faviconSvg() {
  const id = 'fav';
  const r = Math.round(SIZE * 0.22);
  return svg(
    `${defs(id)}\n<clipPath id="${id}-pebble"><rect width="${SIZE}" height="${SIZE}" rx="${r}"/></clipPath>\n<g clip-path="url(#${id}-pebble)">${sky(id)}\n${head(id)}\n${water(id)}</g>`,
  );
}

const masters = {
  'icon.svg': iconSvg(),
  'icon-foreground.svg': foregroundSvg(),
  'icon-background.svg': backgroundSvg(),
  'icon-monochrome.svg': monochromeSvg(),
  'splash-icon.svg': splashSvg(),
  'favicon.svg': faviconSvg(),
};

const outputs = [
  ['icon.svg', 'icon.png', 1024, false],
  ['icon-foreground.svg', 'android-icon-foreground.png', 1024, true],
  ['icon-background.svg', 'android-icon-background.png', 1024, false],
  ['icon-monochrome.svg', 'android-icon-monochrome.png', 1024, true],
  ['splash-icon.svg', 'splash-icon.png', 1024, true],
  ['favicon.svg', 'favicon.png', 48, true],
];

function page(html) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent}
svg{display:block}
</style></head><body>${html}</body></html>`;
}

async function render(browser, svgText, size, transparent, file) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const sized = svgText.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  await p.setContent(page(sized));
  await p.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  await ctx.close();
}

async function contactSheet(browser) {
  mkdirSync(previewDir, { recursive: true });
  const tile = (svgText, size, radius) =>
    `<div class="t"><div style="width:${size}px;height:${size}px;border-radius:${radius}px;overflow:hidden">${svgText.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</div><span>${size}</span></div>`;
  const row = (bg, fg) =>
    `<div class="row" style="background:${bg};color:${fg}">${[16, 32, 48, 64, 120, 180]
      .map((s) => tile(masters['icon.svg'], s, Math.round(s * 0.22)))
      .join('')}</div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:600 13px system-ui;background:#888}
.row{display:flex;align-items:flex-end;gap:28px;padding:28px 32px}
.t{display:flex;flex-direction:column;align-items:center;gap:8px}
svg{display:block}
</style></head><body>
${row(palette.riverMist, palette.deepJungle)}
${row('#FFFFFF', palette.deepJungle)}
${row('#000000', palette.riverMist)}
${row(palette.deepJungle, palette.riverMist)}
</body></html>`;
  const ctx = await browser.newContext({ viewport: { width: 820, height: 980 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.setContent(html);
  await p.screenshot({ path: join(previewDir, 'icon-sizes.png'), fullPage: true });

  // The adaptive layers as Android shows them (circle, squircle, rounded square) plus the mono tint.
  const layered = (clip) =>
    `<div class="t"><div style="width:180px;height:180px;${clip};overflow:hidden;position:relative"><div style="position:absolute;inset:0">${masters['icon-background.svg'].replace(/width="\d+" height="\d+"/, 'width="180" height="180"')}</div><div style="position:absolute;inset:0">${masters['icon-foreground.svg'].replace(/width="\d+" height="\d+"/, 'width="180" height="180"')}</div></div></div>`;
  const mono = `<div class="t"><div style="width:180px;height:180px;border-radius:50%;background:${palette.shallows};overflow:hidden;position:relative"><div style="position:absolute;inset:0;background:${palette.deepJungle};-webkit-mask:url('data:image/svg+xml;utf8,${encodeURIComponent(masters['icon-monochrome.svg'])}') center/100% 100% no-repeat"></div></div><span>themed</span></div>`;
  const adaptive = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:600 13px system-ui;background:${palette.riverMist};color:${palette.deepJungle}}
.row{display:flex;align-items:flex-end;gap:36px;padding:36px}
.t{display:flex;flex-direction:column;align-items:center;gap:10px}
svg{display:block}
</style></head><body><div class="row">
${layered('border-radius:50%')}${layered('border-radius:48px')}${layered('border-radius:26px')}${mono}
</div></body></html>`;
  await p.setViewportSize({ width: 960, height: 290 });
  await p.setContent(adaptive);
  await p.screenshot({ path: join(previewDir, 'icon-android-adaptive.png'), fullPage: true });

  // The splash as expo-splash-screen composes it (390x844, image 200pt wide, River Mist).
  const splash = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:${palette.riverMist};width:390px;height:844px;display:grid;place-items:center}
svg{display:block}
</style></head><body>${masters['splash-icon.svg'].replace(/width="\d+" height="\d+"/, 'width="200" height="200"')}</body></html>`;
  await p.setViewportSize({ width: 390, height: 844 });
  await p.setContent(splash);
  await p.screenshot({ path: join(previewDir, 'splash-390.png') });
  await ctx.close();
}

async function main() {
  mkdirSync(brand, { recursive: true });
  for (const [name, text] of Object.entries(masters)) writeFileSync(join(brand, name), text);

  const browser = await chromium.launch();
  try {
    for (const [master, out, size, transparent] of outputs) {
      await render(browser, masters[master], size, transparent, join(assets, out));
      console.log(`wrote assets/${out} (${size})`);
    }
    if (preview) {
      await contactSheet(browser);
      console.log(`wrote previews to ${previewDir}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
