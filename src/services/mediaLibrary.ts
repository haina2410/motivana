import { Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

export type WallpaperServiceErrorCode =
  | 'PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'SAVE_FAILED'
  | 'INVALID_TARGET'
  | 'WALLPAPER_NOT_ALLOWED'
  | 'LOCK_UNSUPPORTED'
  | 'DECODE_FAILED'
  | 'APPLY_FAILED'
  | 'NOT_IMPLEMENTED';

const errorMessages: Readonly<Record<WallpaperServiceErrorCode, string>> = {
  PERMISSION_DENIED: 'Photo permission is needed to save this wallpaper.',
  FILE_NOT_FOUND:
    'The exported wallpaper is unavailable. Render it again and retry.',
  SAVE_FAILED: 'Could not save the wallpaper.',
  INVALID_TARGET: 'Choose Home, Lock, or Both before applying the wallpaper.',
  WALLPAPER_NOT_ALLOWED: 'This device does not allow changing the wallpaper.',
  LOCK_UNSUPPORTED: 'This device does not support setting the lock screen.',
  DECODE_FAILED: 'The exported wallpaper could not be opened.',
  APPLY_FAILED: 'Could not apply the wallpaper.',
  NOT_IMPLEMENTED: 'Wallpaper rotation is not available yet.',
};

export class WallpaperServiceError extends Error {
  readonly canAskAgain?: boolean;

  constructor(
    readonly code: WallpaperServiceErrorCode,
    options?: { canAskAgain?: boolean },
  ) {
    super(errorMessages[code]);
    this.name = 'WallpaperServiceError';
    this.canAskAgain = options?.canAskAgain;
  }
}

export interface MediaLibrarySaveDependencies {
  appCacheUri: string;
  requestPermissionsAsync(options: {
    writeOnly: true;
    granularPermissions: ['photo'];
  }): Promise<{ granted: boolean; canAskAgain: boolean }>;
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
    const permission = await dependencies.requestPermissionsAsync({
      writeOnly: true,
      granularPermissions: ['photo'],
    });
    if (!permission.granted) {
      throw new WallpaperServiceError('PERMISSION_DENIED', {
        canAskAgain: permission.canAskAgain,
      });
    }
    try {
      const asset = await dependencies.createAsset(uri);
      return { assetId: asset.id };
    } catch {
      throw new WallpaperServiceError('SAVE_FAILED');
    }
  };
}

const mediaLibraryDependencies: MediaLibrarySaveDependencies = {
  appCacheUri: Paths.cache.uri,
  requestPermissionsAsync: async () =>
    MediaLibrary.requestPermissionsAsync(true, ['photo']),
  createAsset: (uri) => MediaLibrary.Asset.create(uri),
};

export const saveWallpaper = createMediaLibrarySaver(mediaLibraryDependencies);
