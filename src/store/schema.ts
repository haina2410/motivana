import { getLocales } from 'expo-localization';
import {
  getQuoteById,
  getAllQuotes,
  quoteInLocale,
} from '../features/quotes/quoteRepository';
import { getPresetById } from '../features/wallpaper/presetRepository';
import {
  isContentLocale,
  isLocale,
  resolveDeviceLocale,
  type ContentLocale,
  type Locale,
} from '../features/i18n/locale';
import {
  isRotationSchedule,
  rotationScheduleFromLegacyHours,
  type RotationSchedule,
} from '../features/rotation/schedule';
import { APP_STATE_STORAGE_KEY, type KeyValueStorage } from './storage';

export type WallpaperTarget = 'home' | 'lock' | 'both';

export interface PersistedAppStateV3 {
  version: 3;
  appLocale: Locale;
  contentLocale: ContentLocale;
  favoriteQuoteIds: string[];
  currentQuoteId: string;
  lastAppliedQuoteId?: string;
  selectedPresetId: string;
  randomizePreset: boolean;
  favoriteQuotesOnly: boolean;
  rotationEnabled: boolean;
  rotationSchedule: RotationSchedule;
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
function firstQuoteInLocale(locale: ContentLocale): string {
  return getAllQuotes(locale)[0]?.id ?? firstQuoteId;
}

/** The quotes are written for Vietnamese readers first, so they start there. */
const DEFAULT_CONTENT_LOCALE: ContentLocale = 'vi';

function deviceLocale(): Locale {
  try {
    return resolveDeviceLocale(getLocales().map((entry) => entry.languageTag));
  } catch {
    return 'en';
  }
}

export function createDefaultPersistedAppState(): PersistedAppStateV3 {
  return {
    version: 3,
    // The interface follows the device; the quotes do not.
    appLocale: deviceLocale(),
    contentLocale: DEFAULT_CONTENT_LOCALE,
    favoriteQuoteIds: [],
    currentQuoteId: firstQuoteInLocale(DEFAULT_CONTENT_LOCALE),
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationSchedule: 'daily',
    wallpaperTarget: 'both',
    saveToPhotoLibrary: false,
    showSafeGuides: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

export function isValidRotationSchedule(
  value: unknown,
): value is RotationSchedule {
  return isRotationSchedule(value);
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
  const contentLocale = isContentLocale(input.contentLocale)
    ? input.contentLocale
    : DEFAULT_CONTENT_LOCALE;
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
    // A reader on the old six, twelve or twenty-four hour control has no
    // schedule stored, so their interval is mapped across before the default.
    rotationSchedule: isRotationSchedule(input.rotationSchedule)
      ? input.rotationSchedule
      : (rotationScheduleFromLegacyHours(input.rotationIntervalHours) ??
        defaults.rotationSchedule),
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
