import { Directory, File, Paths } from 'expo-file-system';

/** Every wallpaper the application writes lands here, named by its cache key. */
export const EXPORT_DIRECTORY_NAME = 'motivana-exports';

export function exportedWallpaperFile(cacheKey: string): File {
  return new File(
    new Directory(Paths.cache, EXPORT_DIRECTORY_NAME),
    `${cacheKey}.png`,
  );
}

/**
 * The wallpaper this composition already produced, if the cache still holds it.
 *
 * A finished PNG needs neither the Skia typefaces nor a draw, so the preview can
 * show it in the first frame instead of waiting for the font provider. The cache
 * key carries the preset, the quote, the size and a fingerprint of the text, so a
 * file can only match a composition that draws exactly the same wallpaper.
 */
export function exportedWallpaperUri(cacheKey: string): string | undefined {
  try {
    const file = exportedWallpaperFile(cacheKey);
    return file.exists ? file.uri : undefined;
  } catch {
    // A cache the platform cleared, or a sandbox that refuses the read.
    return undefined;
  }
}
