import nativeWallpaperModule from '../../modules/motivana-wallpaper';
import type {
  ConfigureRotationOptions,
  RotationStatus,
  WallpaperCapabilities,
  WallpaperTarget,
} from '../../modules/motivana-wallpaper';

import {
  WallpaperServiceError,
  type WallpaperServiceErrorCode,
} from './mediaLibrary';

const stableNativeCodes = new Set<WallpaperServiceErrorCode>([
  'INVALID_TARGET',
  'WALLPAPER_NOT_ALLOWED',
  'LOCK_UNSUPPORTED',
  'FILE_NOT_FOUND',
  'DECODE_FAILED',
  'APPLY_FAILED',
  'NOT_IMPLEMENTED',
  'DEBUG_ONLY',
  'INVALID_CONFIGURATION',
  'EMPTY_FAVORITES',
  'CONFIGURE_FAILED',
  'ASSET_FAILED',
  'ASSET_INVALID',
  'ASSET_IO',
  'FONT_MISSING',
  'RENDER_FAILED',
  'SCHEDULER_FAILED',
  'SYSTEM_FAILED',
]);

export function validateWallpaperTarget(value: string): WallpaperTarget {
  if (value === 'home' || value === 'lock' || value === 'both') return value;
  throw new WallpaperServiceError('INVALID_TARGET');
}

export function normalizeWallpaperServiceError(
  error: unknown,
): WallpaperServiceError {
  if (error instanceof WallpaperServiceError) return error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (
    typeof code === 'string' &&
    stableNativeCodes.has(code as WallpaperServiceErrorCode)
  ) {
    return new WallpaperServiceError(code as WallpaperServiceErrorCode);
  }
  return new WallpaperServiceError('APPLY_FAILED');
}

export async function getWallpaperCapabilities(): Promise<WallpaperCapabilities> {
  try {
    return await nativeWallpaperModule.getCapabilities();
  } catch (error) {
    throw normalizeWallpaperServiceError(error);
  }
}

export async function setWallpaper(
  uri: string,
  target: WallpaperTarget,
): Promise<void> {
  validateWallpaperTarget(target);
  if (!uri.startsWith('file:'))
    throw new WallpaperServiceError('FILE_NOT_FOUND');
  try {
    await nativeWallpaperModule.setWallpaper(uri, target);
  } catch (error) {
    throw normalizeWallpaperServiceError(error);
  }
}

export async function configureRotation(
  options: ConfigureRotationOptions,
): Promise<void> {
  validateWallpaperTarget(options.target);
  if (![1, 12, 24].includes(options.intervalHours))
    throw new WallpaperServiceError('INVALID_TARGET');
  if (
    options.anchorHour !== undefined &&
    (!Number.isInteger(options.anchorHour) ||
      options.anchorHour < 0 ||
      options.anchorHour > 23)
  )
    throw new WallpaperServiceError('INVALID_TARGET');
  if (options.favoriteQuotesOnly && options.favoriteQuoteIds.length === 0)
    throw new WallpaperServiceError(
      'EMPTY_FAVORITES' as WallpaperServiceErrorCode,
    );
  try {
    await nativeWallpaperModule.configureRotation(options);
  } catch (error) {
    throw normalizeWallpaperServiceError(error);
  }
}

/**
 * Drops the keys the native map sends as null. Kotlin writes every optional
 * field of the status into one map, so a run that carries no error sends
 * `errorCode: null` rather than no key at all. RotationStatus declares those
 * fields optional, and a reader of an optional field treats null as a value:
 * getRotationStatusRecovery would read a successful run as an unknown failure
 * and show an error card.
 */
function withoutNullFields(status: RotationStatus): RotationStatus {
  return Object.fromEntries(
    Object.entries(status).filter(([, value]) => value !== null),
  ) as RotationStatus;
}

export async function getRotationStatus(): Promise<RotationStatus> {
  try {
    return withoutNullFields(await nativeWallpaperModule.getRotationStatus());
  } catch (error) {
    throw normalizeWallpaperServiceError(error);
  }
}

export async function runRotationNow(): Promise<void> {
  try {
    await nativeWallpaperModule.runRotationNow();
  } catch (error) {
    throw normalizeWallpaperServiceError(error);
  }
}
