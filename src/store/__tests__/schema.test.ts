import { getLocales } from 'expo-localization';
import { getAllQuotes } from '../../features/quotes/quoteRepository';
import { getAllBackgrounds } from '../../features/wallpaper/presetRepository';
import {
  createDefaultPersistedAppState,
  hydrateAppState,
  migratePersistedState,
} from '../schema';
import type { KeyValueStorage } from '../storage';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'en-US' }]),
}));

const mockedGetLocales = getLocales as jest.Mock;

afterEach(() => {
  mockedGetLocales.mockReturnValue([{ languageTag: 'en-US' }]);
});

function createMemoryStorage(
  initialEntries: Readonly<Record<string, string>> = {},
): KeyValueStorage {
  const values = new Map(Object.entries(initialEntries));

  return {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key),
  };
}

// Mutation caught: removing the safe JSON parse fallback would let corrupt persisted data crash hydration.
test('falls back to defaults when persisted JSON is corrupt', () => {
  const warnings: string[] = [];
  const state = hydrateAppState(
    createMemoryStorage({ 'motivana.app-state': '{not json' }),
    (message) => warnings.push(message),
  );

  expect(state).toMatchObject({
    version: 3,
    currentQuoteId: getAllQuotes()[0]!.id,
    selectedPresetId: 'midnight-focus',
    favoriteQuoteIds: [],
    rotationSchedule: 'daily',
    wallpaperTarget: 'both',
  });
  expect(warnings).toEqual([
    'Motivana preferences were reset because stored preferences are invalid.',
  ]);
});

// Mutation caught: accepting an unsupported version would allow incompatible data into state.
test('falls back from a future persisted version and emits a safe warning', () => {
  const warnings: string[] = [];
  const state = hydrateAppState(
    createMemoryStorage({
      'motivana.app-state': JSON.stringify({
        version: 4,
        secret: 'do-not-log-me',
      }),
    }),
    (message) => warnings.push(message),
  );

  expect(state.currentQuoteId).toBe(getAllQuotes()[0]!.id);
  expect(warnings).toEqual([
    'Motivana preferences were reset because the stored version is unsupported.',
  ]);
  expect(warnings.join(' ')).not.toContain('do-not-log-me');
});

// Mutation caught: skipping catalog validation would retain IDs that no longer resolve after an app update.
test('repairs catalog IDs removed by an app update', () => {
  expect(
    migratePersistedState({
      version: 1,
      currentQuoteId: 'gone',
      lastAppliedQuoteId: 'also-gone',
      selectedPresetId: 'gone',
    }),
  ).toMatchObject({
    currentQuoteId: getAllQuotes()[0]!.id,
    selectedPresetId: 'midnight-focus',
  });
});

// Mutation caught: failing to normalize favorites would permit duplicate or removed quote IDs into persisted state.
test('dedupes favorites and drops quote IDs that no longer exist', () => {
  const quoteId = getAllQuotes()[1]!.id;

  expect(
    migratePersistedState({
      version: 1,
      favoriteQuoteIds: [quoteId, quoteId, 'gone'],
    }),
  ).toMatchObject({ favoriteQuoteIds: [quoteId] });
});

// Mutation caught: accepting arbitrary setting values would create a state native automation cannot consume.
test('repairs invalid rotation configuration values to safe defaults', () => {
  expect(
    migratePersistedState({
      version: 1,
      randomizePreset: 'yes',
      favoriteQuotesOnly: 'yes',
      rotationEnabled: 'yes',
      rotationIntervalHours: 8,
      wallpaperTarget: 'desktop',
    }),
  ).toMatchObject({
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationSchedule: 'daily',
    wallpaperTarget: 'both',
  });
});

// Mutation caught: retaining favorites-only after catalog repair empties favorites would persist an impossible automation configuration.
test('disables favorites-only when repaired favorites are empty', () => {
  expect(
    migratePersistedState({
      version: 1,
      favoriteQuoteIds: ['gone'],
      favoriteQuotesOnly: true,
    }),
  ).toMatchObject({
    favoriteQuoteIds: [],
    favoriteQuotesOnly: false,
  });
});

// Mutation caught: resetting on version 1 would erase every saved favorite when the reader updates the app.
test('migrates version 1 state and keeps every favorite', () => {
  const migrated = migratePersistedState({
    version: 1,
    favoriteQuoteIds: ['motivation-001', 'focus-002'],
    currentQuoteId: 'motivation-001',
    selectedPresetId: 'midnight-focus',
    randomizePreset: true,
    favoriteQuotesOnly: true,
    rotationEnabled: true,
    rotationIntervalHours: 12,
    wallpaperTarget: 'both',
  });

  expect(migrated.version).toBe(3);
  expect(migrated.favoriteQuoteIds).toEqual(['motivation-001', 'focus-002']);
  expect(migrated.randomizePreset).toBe(true);
  expect(migrated.rotationSchedule).toBe('twice-daily');
  expect(migrated.wallpaperTarget).toBe('both');
  expect(migrated.appLocale).toBe('en');
  expect(migrated.contentLocale).toBe('vi');
});

// Mutation caught: sharing one locale field would tie the interface language to the quote language.
test('keeps the interface and quote languages independent', () => {
  const migrated = migratePersistedState({
    version: 2,
    appLocale: 'vi',
    contentLocale: 'en',
    favoriteQuoteIds: [],
    currentQuoteId: 'motivation-001',
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
  });

  expect(migrated.appLocale).toBe('vi');
  expect(migrated.contentLocale).toBe('en');
});

// Mutation caught: accepting an unsupported stored locale would render undefined interface strings.
test('replaces an unsupported stored locale with a supported one', () => {
  const migrated = migratePersistedState({
    version: 2,
    appLocale: 'fr',
    contentLocale: 42,
    favoriteQuoteIds: [],
    currentQuoteId: 'motivation-001',
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
  });

  expect(migrated.appLocale).toBe('en');
  expect(migrated.contentLocale).toBe('vi');
});

// Mutation caught: ignoring the device language would show a Vietnamese reader an English interface on first launch.
test('takes the interface language from the device', () => {
  mockedGetLocales.mockReturnValue([{ languageTag: 'vi-VN' }]);

  const state = createDefaultPersistedAppState();

  expect(state.appLocale).toBe('vi');
  expect(state.contentLocale).toBe('vi');
});

// Mutation caught: tying the quote language to the device would hand an English
// reader the smaller English pool, when the catalog is written for Vietnamese.
test('starts the quotes in Vietnamese whatever the device says', () => {
  mockedGetLocales.mockReturnValue([{ languageTag: 'en-US' }]);

  const state = createDefaultPersistedAppState();

  expect(state.appLocale).toBe('en');
  expect(state.contentLocale).toBe('vi');
});

// Mutation caught: trusting an unsupported device language directly would produce a locale the catalog and strings do not have.
test('falls back to English for the interface when the device language is unsupported', () => {
  mockedGetLocales.mockReturnValue([{ languageTag: 'fr-FR' }]);

  const state = createDefaultPersistedAppState();

  expect(state.appLocale).toBe('en');
  expect(state.contentLocale).toBe('vi');
});

// Mutation caught: keeping a stored quote that has no text in the reader's quote
// language would show them the other language outside the favorites exception.
test('moves the shown quote into the pool when the stored one is not in that language', () => {
  const englishOnly = getAllQuotes('en').find(
    (quote) => quote.text.vi === undefined,
  )!;

  const migrated = migratePersistedState({
    version: 2,
    appLocale: 'vi',
    contentLocale: 'vi',
    favoriteQuoteIds: [englishOnly.id],
    currentQuoteId: englishOnly.id,
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
  });

  expect(migrated.currentQuoteId).not.toBe(englishOnly.id);
  expect(
    getAllQuotes('vi').some((quote) => quote.id === migrated.currentQuoteId),
  ).toBe(true);
  // The favorites exception still holds: the id survives in any language.
  expect(migrated.favoriteQuoteIds).toEqual([englishOnly.id]);
});

// Mutation caught: a version 1 user has no contentLocale, so the device language
// decides the pool and the stored quote can fall outside it.
test('repairs a version 1 quote that is missing from the device language pool', () => {
  mockedGetLocales.mockReturnValue([{ languageTag: 'vi-VN' }]);
  const englishOnly = getAllQuotes('en').find(
    (quote) => quote.text.vi === undefined,
  )!;

  const migrated = migratePersistedState({
    version: 1,
    favoriteQuoteIds: [],
    currentQuoteId: englishOnly.id,
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
  });

  expect(migrated.contentLocale).toBe('vi');
  expect(migrated.currentQuoteId).not.toBe(englishOnly.id);
  expect(
    getAllQuotes('vi').some((quote) => quote.id === migrated.currentQuoteId),
  ).toBe(true);
});

// Mutation caught: only the invalid case was covered, so dropping a good
// lastAppliedQuoteId would have gone unnoticed on the data-loss path.
test('keeps a valid lastAppliedQuoteId across the migration', () => {
  const migrated = migratePersistedState({
    version: 1,
    favoriteQuoteIds: [],
    currentQuoteId: 'motivation-001',
    lastAppliedQuoteId: 'focus-002',
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
  });

  expect(migrated.lastAppliedQuoteId).toBe('focus-002');
});

// Mutation caught: guarding the stored setting with isLocale would drop a reader back to Vietnamese on every launch.
test('keeps the every-language quote setting across a launch', () => {
  const migrated = migratePersistedState({
    version: 3,
    appLocale: 'en',
    contentLocale: 'all',
    favoriteQuoteIds: [],
    currentQuoteId: 'motivation-001',
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
  });

  expect(migrated.contentLocale).toBe('all');
  expect(migrated.currentQuoteId).toBe('motivation-001');
  expect(migrated.appLocale).toBe('en');
});

// Mutation caught: dropping the legacy interval would reset a reader who chose
// six-hour rotation to the daily default instead of the nearest named schedule.
test('maps a stored interval onto a named schedule, preferring an explicit one', () => {
  expect(
    migratePersistedState({ version: 2, rotationIntervalHours: 6 })
      .rotationSchedule,
  ).toBe('twice-daily');
  expect(
    migratePersistedState({ version: 2, rotationIntervalHours: 24 })
      .rotationSchedule,
  ).toBe('daily');
  expect(
    migratePersistedState({
      version: 3,
      rotationSchedule: 'hourly',
      rotationIntervalHours: 24,
    }).rotationSchedule,
  ).toBe('hourly');
  expect(
    migratePersistedState({ version: 3, rotationSchedule: 'weekly' })
      .rotationSchedule,
  ).toBe('daily');
});

// Mutation caught: validating the selection against presets.json alone would
// reject a saved photograph on the next launch and reset the reader's choice.
test('a photographic background survives as a persisted selection', () => {
  const backgroundId = getAllBackgrounds()[0]!.id;

  expect(
    migratePersistedState({ version: 3, selectedPresetId: backgroundId })
      .selectedPresetId,
  ).toBe(backgroundId);
});
