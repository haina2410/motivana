import { Directory, File, Paths } from 'expo-file-system';

/** Every wallpaper the application writes lands here, named by its cache key. */
export const EXPORT_DIRECTORY_NAME = 'motivana-exports';

export function exportedWallpaperFile(cacheKey: string): File {
  return new File(
    new Directory(Paths.cache, EXPORT_DIRECTORY_NAME),
    `${cacheKey}.png`,
  );
}
