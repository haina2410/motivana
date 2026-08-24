import { getLocales } from 'expo-localization';
import { getQuoteById, getAllQuotes } from '../features/quotes/quoteRepository';
import { getPresetById } from '../features/wallpaper/presetRepository';
import {
  isLocale,
  resolveDeviceLocale,
  type Locale,
} from '../features/i18n/locale';
import { APP_STATE_STORAGE_KEY, type KeyValueStorage } from './storage';

export type RotationIntervalHours = 6 | 12 | 24;
export type WallpaperTarget = 'home' | 'lock' | 'both';

export interface PersistedAppStateV2 {
  version: 2;
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
}

export type PersistedAppState = PersistedAppStateV2;
export type SafeWarningReporter = (message: string) => void;

const firstQuoteId = getAllQuotes()[0]!.id;

function deviceLocale(): Locale {
  try {
    return resolveDeviceLocale(getLocales().map((entry) => entry.languageTag));
  } catch {
    return 'en';
  }
}

export function createDefaultPersistedAppState(): PersistedAppStateV2 {
  return {
    version: 2,
    appLocale: deviceLocale(),
    contentLocale: deviceLocale(),
    favoriteQuoteIds: [],
    currentQuoteId: firstQuoteId,
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
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

export function migratePersistedState(input: unknown): PersistedAppStateV2 {
  const defaults = createDefaultPersistedAppState();
  if (!isRecord(input) || (input.version !== 1 && input.version !== 2)) {
    return defaults;
  }

  const favoriteQuoteIds = Array.isArray(input.favoriteQuoteIds)
    ? Array.from(new Set(input.favoriteQuoteIds.filter(validQuoteId)))
    : defaults.favoriteQuoteIds;
  const currentQuoteId = validQuoteId(input.currentQuoteId)
    ? input.currentQuoteId
    : defaults.currentQuoteId;
  const lastAppliedQuoteId = validQuoteId(input.lastAppliedQuoteId)
    ? input.lastAppliedQuoteId
    : undefined;

  return {
    version: 2,
    appLocale: isLocale(input.appLocale) ? input.appLocale : deviceLocale(),
    contentLocale: isLocale(input.contentLocale)
      ? input.contentLocale
      : deviceLocale(),
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
  };
}

export function hydrateAppState(
  storage: KeyValueStorage,
  warn: SafeWarningReporter = console.warn,
): PersistedAppStateV2 {
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
  if (parsed.version > 2) {
    warn(
      'Motivana preferences were reset because the stored version is unsupported.',
    );
    return createDefaultPersistedAppState();
  }
  if (parsed.version !== 1 && parsed.version !== 2) {
    warn(
      'Motivana preferences were reset because stored preferences are invalid.',
    );
    return createDefaultPersistedAppState();
  }

  return migratePersistedState(parsed);
}

export function serializePersistedAppState(state: PersistedAppStateV2): string {
  return JSON.stringify(state);
}
