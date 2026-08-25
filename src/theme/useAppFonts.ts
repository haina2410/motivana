import { useFonts } from 'expo-font';

/**
 * Loads the Be Vietnam Pro chrome faces. The wallpaper typefaces load
 * separately through Skia (`useWallpaperFonts`), because Skia keeps its own
 * typeface provider and cannot read a React Native font registration.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    'BeVietnamPro-Light': require('../../assets/fonts/BeVietnamPro-Light.ttf'),
    'BeVietnamPro-Regular': require('../../assets/fonts/BeVietnamPro-Regular.ttf'),
    'BeVietnamPro-Medium': require('../../assets/fonts/BeVietnamPro-Medium.ttf'),
    'BeVietnamPro-SemiBold': require('../../assets/fonts/BeVietnamPro-SemiBold.ttf'),
  });
  // A failed font load must not hide the application behind a splash screen
  // forever; the system face is an acceptable fallback for chrome text.
  return loaded || error !== null;
}
