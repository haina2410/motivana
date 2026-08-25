import { getLocales } from 'expo-localization';
import {
  getQuoteById,
  getAllQuotes,
  quoteInLocale,
} from '../features/quotes/quoteRepository';
import { getPresetById } from '../features/wallpaper/presetRepository';
import {
  isLocale,
  resolveDeviceLocale,
  type Locale,
} from '../features/i18n/locale';
import { APP_STATE_STORAGE_KEY, type KeyValueStorage } from './storage';

export type RotationIntervalHours = 6 | 12 | 24;
export type WallpaperTarget = 'home' | 'lock' | 'both';

export interface PersistedAppStateV3 {
  version: 3;
  appLocale: Locale;
  contentLocale: Locale;
  favoriteQuoteIds: string[];
  currentQuoteId: string;
  lastAppliedQuoteId?: string;
  selectedPresetId: string;
  randomizePreset: boolean;
  favoriteQuotesOnly: boolean;
  rotationEnabled: boolean;
  rotationIntervalHours: RotationIntervalHours;
  wallpaperTarget: WallpaperTarget;
  /** Applying a wallpaper also writes a copy to the photo library. */
  saveToPhotoLibrary: boolean;
  /** Draws the launcher safe-area guides over the preview. */
  showSafeGuides: boolean;
}

/** Kept as an alias, so the many call sites naming V2 do not all have to move. */
export type PersistedAppStateV2 = PersistedAppStateV3;
export type PersistedAppState = PersistedAppStateV3;
export type SafeWarningReporter = (message: string) => void;

const firstQuoteId = getAllQuotes()[0]!.id;

/** Falls back to the whole catalog only if a locale has no quotes at all. */
function firstQuoteInLocale(locale: Locale): string {
  return getAllQuotes(locale)[0]?.id ?? firstQuoteId;
}

function deviceLocale(): Locale {
  try {
    return resolveDeviceLocale(getLocales().map((entry) => entry.languageTag));
  } catch {
    return 'en';
  }
}

export function createDefaultPersistedAppState(): PersistedAppStateV3 {
  // Resolved one time, so both languages start from the same device answer.
  const locale = deviceLocale();
  return {
    version: 3,
    appLocale: locale,
    contentLocale: locale,
    favoriteQuoteIds: [],
    currentQuoteId: firstQuoteInLocale(locale),
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
    saveToPhotoLibrary: false,
    showSafeGuides: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRotationIntervalHours(
  value: unknown,
): value is RotationIntervalHours {
  return value === 6 || value === 12 || value === 24;
}

function isWallpaperTarget(value: unknown): value is WallpaperTarget {
  return value === 'home' || value === 'lock' || value === 'both';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function validQuoteId(value: unknown): value is string {
  return typeof value === 'string' && getQuoteById(value) !== undefined;
}

function validPresetId(value: unknown): value is string {
  return typeof value === 'string' && getPresetById(value) !== undefined;
}

export function isValidRotationIntervalHours(
  value: unknown,
): value is RotationIntervalHours {
  return isRotationIntervalHours(value);
}

export function isValidWallpaperTarget(
  value: unknown,
): value is WallpaperTarget {
  return isWallpaperTarget(value);
}

export function isValidQuoteId(value: unknown): value is string {
  return validQuoteId(value);
}

export function isValidPresetId(value: unknown): value is string {
  return validPresetId(value);
}

const supportedVersions = [1, 2, 3];

export function migratePersistedState(input: unknown): PersistedAppStateV3 {
  const defaults = createDefaultPersistedAppState();
  if (
    !isRecord(input) ||
    !supportedVersions.includes(input.version as number)
  ) {
    return defaults;
  }

  const favoriteQuoteIds = Array.isArray(input.favoriteQuoteIds)
    ? Array.from(new Set(input.favoriteQuoteIds.filter(validQuoteId)))
    : defaults.favoriteQuoteIds;
  const contentLocale = isLocale(input.contentLocale)
    ? input.contentLocale
    : deviceLocale();
  // The shown quote must exist in the reader's quote language. A version 1 user
  // has no contentLocale, so their stored quote can fall outside the new pool.
  const currentQuoteId =
    validQuoteId(input.currentQuoteId) &&
    quoteInLocale(input.currentQuoteId, contentLocale)
      ? input.currentQuoteId
      : firstQuoteInLocale(contentLocale);
  const lastAppliedQuoteId = validQuoteId(input.lastAppliedQuoteId)
    ? input.lastAppliedQuoteId
    : undefined;

  return {
    version: 3,
    appLocale: isLocale(input.appLocale) ? input.appLocale : deviceLocale(),
    contentLocale,
    favoriteQuoteIds,
    currentQuoteId,
    ...(lastAppliedQuoteId === undefined ? {} : { lastAppliedQuoteId }),
    selectedPresetId: validPresetId(input.selectedPresetId)
      ? input.selectedPresetId
      : defaults.selectedPresetId,
    randomizePreset: isBoolean(input.randomizePreset)
      ? input.randomizePreset
      : defaults.randomizePreset,
    favoriteQuotesOnly:
      isBoolean(input.favoriteQuotesOnly) &&
      input.favoriteQuotesOnly &&
      favoriteQuoteIds.length > 0,
    rotationEnabled: isBoolean(input.rotationEnabled)
      ? input.rotationEnabled
      : defaults.rotationEnabled,
    rotationIntervalHours: isRotationIntervalHours(input.rotationIntervalHours)
      ? input.rotationIntervalHours
      : defaults.rotationIntervalHours,
    wallpaperTarget: isWallpaperTarget(input.wallpaperTarget)
      ? input.wallpaperTarget
      : defaults.wallpaperTarget,
    // Absent for a version 1 or 2 reader, who never chose either option.
    saveToPhotoLibrary: isBoolean(input.saveToPhotoLibrary)
      ? input.saveToPhotoLibrary
      : defaults.saveToPhotoLibrary,
    showSafeGuides: isBoolean(input.showSafeGuides)
      ? input.showSafeGuides
      : defaults.showSafeGuides,
  };
}

export function hydrateAppState(
  storage: KeyValueStorage,
  warn: SafeWarningReporter = console.warn,
): PersistedAppStateV3 {
  const serialized = storage.getString(APP_STATE_STORAGE_KEY);
  if (serialized === undefined) {
    return createDefaultPersistedAppState();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    warn(
      'Motivana preferences were reset because stored preferences are invalid.',
    );
    return createDefaultPersistedAppState();
  }

  if (!isRecord(parsed) || typeof parsed.version !== 'number') {
    warn(
      'Motivana preferences were reset because stored preferences are invalid.',
    );
    return createDefaultPersistedAppState();
  }
  if (parsed.version > 3) {
    warn(
      'Motivana preferences were reset because the stored version is unsupported.',
    );
    return createDefaultPersistedAppState();
  }
  if (!supportedVersions.includes(parsed.version)) {
    warn(
      'Motivana preferences were reset because stored preferences are invalid.',
    );
    return createDefaultPersistedAppState();
  }

  return migratePersistedState(parsed);
}

export function serializePersistedAppState(state: PersistedAppStateV3): string {
  return JSON.stringify(state);
}
