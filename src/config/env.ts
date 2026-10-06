/**
 * Public build flags. `EXPO_PUBLIC_*` variables are inlined at build time.
 * Dev mode enables the /dev/gallery route and the dashed placeholder marks on copy.
 * Default: on in development (`__DEV__`), off in every export. `npm run build:web` (the QA build) and
 * `npm run build:web:e2e` set EXPO_PUBLIC_DEV_MODE=1; `npm run build:web:release` and EAS builds leave it off.
 *
 * Metro caches transforms without the flag in the cache key, so every export script passes `--clear`
 * and then runs scripts/check-web-build.mjs, which looks for the marker below in the emitted bundle.
 */
const flag = process.env.EXPO_PUBLIC_DEV_MODE;

export const devMode: boolean = flag === undefined ? __DEV__ : flag === '1' || flag === 'true';

/**
 * Build marker for scripts/check-web-build.mjs. The flag is inlined as a literal, so the minifier
 * keeps exactly one branch and the bundle contains exactly one of the two strings.
 */
export let webBuildMarker: string;
if (process.env.EXPO_PUBLIC_DEV_MODE === '1' || process.env.EXPO_PUBLIC_DEV_MODE === 'true') {
  webBuildMarker = 'mhp-web-build:dev-mode-on';
} else {
  webBuildMarker = 'mhp-web-build:dev-mode-off';
}

/**
 * Base URL of the MHP account service (and later the Hypnose app API). Inlined at build time from
 * EXPO_PUBLIC_API_URL; defaults to the dev server in `server/` (`npm run server`, port 4000).
 * Android emulators reach the host machine at http://10.0.2.2:4000, physical devices at the
 * machine's LAN address: set EXPO_PUBLIC_API_URL in `.env.local` for those.
 */
export const apiUrl: string = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

/** This app's client id on the shared MHP user pool. */
export const authClientId = 'mhp-hypnose';
