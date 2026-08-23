import { getAllQuotes } from '../../features/quotes/quoteRepository';
import { hydrateAppState, migratePersistedState } from '../schema';
import type { KeyValueStorage } from '../storage';

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
    version: 1,
    currentQuoteId: getAllQuotes()[0]!.id,
    selectedPresetId: 'midnight-focus',
    favoriteQuoteIds: [],
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
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
        version: 2,
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
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
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
