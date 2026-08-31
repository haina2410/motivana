import { Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

export type WallpaperServiceErrorCode =
  | 'PERMISSION_DENIED'
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
  PERMISSION_DENIED: 'Storage permission is needed to save this wallpaper.',
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

// expo-media-library picks AssetModernFactory, which inserts through MediaStore
// and needs no permission, only from this level up. Below it AssetLegacyFactory
// starts with requireWritePermissions() and throws without WRITE_EXTERNAL_STORAGE.
const modernMediaStoreApiLevel = 30;
// Android 10 enforces scoped storage by target SDK, and this app targets 36, so
// the legacy factory's direct file copy into shared storage is refused whatever
// the user answers. API 29 is the single level where no save path works.
const scopedStorageOnlyApiLevel = 29;

export function canSaveToPhotoLibrary(apiLevel: number): boolean {
  return apiLevel !== scopedStorageOnlyApiLevel;
}

export function requiresWritePermission(apiLevel: number): boolean {
  return apiLevel < modernMediaStoreApiLevel;
}

export interface MediaLibrarySaveDependencies {
  appCacheUri: string;
  apiLevel: number;
  requestWritePermission(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
  }>;
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
    if (!canSaveToPhotoLibrary(dependencies.apiLevel)) {
      throw new WallpaperServiceError('SAVE_FAILED');
    }
    if (requiresWritePermission(dependencies.apiLevel)) {
      let permission: { granted: boolean; canAskAgain: boolean };
      try {
        permission = await dependencies.requestWritePermission();
      } catch {
        throw new WallpaperServiceError('SAVE_FAILED');
      }
      if (!permission.granted) {
        throw new WallpaperServiceError('PERMISSION_DENIED', {
          canAskAgain: permission.canAskAgain,
        });
      }
    }
    try {
      const asset = await dependencies.createAsset(uri);
      return { assetId: asset.id };
    } catch {
      throw new WallpaperServiceError('SAVE_FAILED');
    }
  };
}

// The request is write-only. Passing granularPermissions alongside writeOnly
// would be dead weight: MediaLibraryModule drops the granular list whenever
// writeOnly is set, so ['photo'] only ever added READ_MEDIA_IMAGES to the
// manifest without the app asking for or using it.
const mediaLibraryDependencies: MediaLibrarySaveDependencies = {
  appCacheUri: Paths.cache.uri,
  apiLevel: Number(Platform.Version),
  requestWritePermission: async () =>
    MediaLibrary.requestPermissionsAsync(true),
  createAsset: (uri) => MediaLibrary.Asset.create(uri),
};

export const saveWallpaper = createMediaLibrarySaver(mediaLibraryDependencies);
