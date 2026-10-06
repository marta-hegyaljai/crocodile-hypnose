import {
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} from '@expo-google-fonts/baloo-2';
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { useFonts } from 'expo-font';

/** The exact set of font faces the type scale uses (see tokens.ts `fontFamily`). */
export const appFonts = {
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
};

/** Loads the app fonts. Returns `[loaded, error]`; render nothing (keep the splash) until loaded. */
export function useAppFonts(): [boolean, Error | null] {
  return useFonts(appFonts);
}
