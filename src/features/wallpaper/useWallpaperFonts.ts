import { Skia, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

const wallpaperFontSources: Readonly<Record<string, number[]>> = {
  CormorantGaramond: [
    require('../../../assets/fonts/CormorantGaramond-Light.ttf'),
    require('../../../assets/fonts/CormorantGaramond-Regular.ttf'),
  ],
  BeVietnamPro: [require('../../../assets/fonts/BeVietnamPro-Light.ttf')],
  DancingScript: [require('../../../assets/fonts/DancingScript-Medium.ttf')],
  Lora: [
    require('../../../assets/fonts/Lora-Regular.ttf'),
    require('../../../assets/fonts/Lora-SemiBold.ttf'),
  ],
};

let loadedProvider: SkTypefaceFontProvider | undefined;
let providerPromise: Promise<SkTypefaceFontProvider> | undefined;

async function loadFontProvider(): Promise<SkTypefaceFontProvider> {
  const typefaces = await Promise.all(
    Object.entries(wallpaperFontSources).flatMap(([family, sources]) =>
      sources.map(async (source) => {
        const data = await Skia.Data.fromURI(
          Image.resolveAssetSource(source).uri,
        );
        const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
        if (!typeface) {
          throw new Error(`Could not create the ${family} typeface.`);
        }
        return [family, typeface] as const;
      }),
    ),
  );
  const provider = Skia.TypefaceFontProvider.Make();
  typefaces.forEach(([family, typeface]) =>
    provider.registerFont(typeface, family),
  );
  loadedProvider = provider;
  return provider;
}

/**
 * Loads the wallpaper typefaces one time for the whole application. Skia
 * `useFonts` keeps no cache, so each preview would read every font file again.
 */
export function getWallpaperFontProvider(): Promise<SkTypefaceFontProvider> {
  if (!providerPromise) {
    providerPromise = loadFontProvider().catch((error: unknown) => {
      providerPromise = undefined; // Lets a later mount retry the load.
      throw error;
    });
  }
  return providerPromise;
}

export function useWallpaperFonts(): SkTypefaceFontProvider | null {
  const [provider, setProvider] = useState(loadedProvider);
  useEffect(() => {
    if (provider) return;
    let active = true;
    getWallpaperFontProvider()
      .then((loaded) => {
        if (active) setProvider(loaded);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [provider]);
  return provider ?? null;
}
