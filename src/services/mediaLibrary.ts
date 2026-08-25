import { Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

export type WallpaperServiceErrorCode =
  | 'FILE_NOT_FOUND'
  | 'SAVE_FAILED'
  | 'INVALID_TARGET'
  | 'WALLPAPER_NOT_ALLOWED'
  | 'LOCK_UNSUPPORTED'
  | 'DECODE_FAILED'
  | 'APPLY_FAILED'
  | 'NOT_IMPLEMENTED'
  | 'DEBUG_ONLY'
  | 'INVALID_CONFIGURATION'
  | 'EMPTY_FAVORITES'
  | 'CONFIGURE_FAILED'
  | 'ASSET_FAILED'
  | 'ASSET_INVALID'
  | 'ASSET_IO'
  | 'FONT_MISSING'
  | 'RENDER_FAILED'
  | 'SCHEDULER_FAILED'
  | 'SYSTEM_FAILED';

const errorMessages: Readonly<Record<WallpaperServiceErrorCode, string>> = {
  FILE_NOT_FOUND:
    'The exported wallpaper is unavailable. Render it again and retry.',
  SAVE_FAILED: 'Could not save the wallpaper.',
  INVALID_TARGET: 'Choose Home, Lock, or Both before applying the wallpaper.',
  WALLPAPER_NOT_ALLOWED: 'This device does not allow changing the wallpaper.',
  LOCK_UNSUPPORTED: 'This device does not support setting the lock screen.',
  DECODE_FAILED: 'The exported wallpaper could not be opened.',
  APPLY_FAILED: 'Could not apply the wallpaper.',
  NOT_IMPLEMENTED: 'Wallpaper rotation is not available yet.',
  DEBUG_ONLY: 'Run rotation now is available in development builds only.',
  INVALID_CONFIGURATION: 'Check the rotation preferences and try again.',
  EMPTY_FAVORITES: 'Add a favorite before using favorites-only rotation.',
  CONFIGURE_FAILED: 'Could not save wallpaper rotation preferences.',
  ASSET_FAILED: 'Wallpaper rotation assets are unavailable.',
  ASSET_INVALID:
    'Wallpaper rotation assets are invalid. Update or reinstall the app.',
  ASSET_IO:
    'Wallpaper rotation assets are temporarily unavailable. It will retry.',
  FONT_MISSING:
    'A required wallpaper font is unavailable. Update or reinstall the app.',
  RENDER_FAILED: 'Could not render the scheduled wallpaper.',
  SCHEDULER_FAILED: 'Could not confirm wallpaper rotation scheduling.',
  SYSTEM_FAILED:
    'Android could not apply the scheduled wallpaper. It will retry.',
};

export class WallpaperServiceError extends Error {
  constructor(readonly code: WallpaperServiceErrorCode) {
    super(errorMessages[code]);
    this.name = 'WallpaperServiceError';
  }
}

export interface MediaLibrarySaveDependencies {
  appCacheUri: string;
  createAsset(uri: string): Promise<{ id: string }>;
}

export function isAppOwnedWallpaperUri(
  uri: string,
  appCacheUri: string,
): boolean {
  const exportsPrefix = `${appCacheUri.replace(/\/$/, '')}/motivana-exports/`;
  return uri.startsWith(exportsPrefix) && uri.endsWith('.png');
}

export function createMediaLibrarySaver(
  dependencies: MediaLibrarySaveDependencies,
): (uri: string) => Promise<{ assetId: string }> {
  return async (uri) => {
    if (!isAppOwnedWallpaperUri(uri, dependencies.appCacheUri)) {
      throw new WallpaperServiceError('FILE_NOT_FOUND');
    }
    try {
      const asset = await dependencies.createAsset(uri);
      return { assetId: asset.id };
    } catch {
      throw new WallpaperServiceError('SAVE_FAILED');
    }
  };
}

// No permission request precedes the write. From Android 11 the library adds
// the asset with a MediaStore insert, which needs no permission, and the app
// declares none. The minimum SDK is pinned to 30 to keep that path the only one.
const mediaLibraryDependencies: MediaLibrarySaveDependencies = {
  appCacheUri: Paths.cache.uri,
  createAsset: (uri) => MediaLibrary.Asset.create(uri),
};

export const saveWallpaper = createMediaLibrarySaver(mediaLibraryDependencies);
