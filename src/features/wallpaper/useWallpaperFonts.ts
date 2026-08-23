import { useFonts } from '@shopify/react-native-skia';

const wallpaperFontSources = {
  Inter: [
    require('../../../assets/fonts/Inter-Regular.ttf'),
    require('../../../assets/fonts/Inter-SemiBold.ttf'),
  ],
  Lora: [
    require('../../../assets/fonts/Lora-Regular.ttf'),
    require('../../../assets/fonts/Lora-SemiBold.ttf'),
  ],
  Oswald: [require('../../../assets/fonts/Oswald-Medium.ttf')],
};

export function useWallpaperFonts() {
  return useFonts(wallpaperFontSources);
}
