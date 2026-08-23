import { getAllQuotes } from '../../features/quotes/quoteRepository';
import { createAppStore, useAppStore } from '../useAppStore';
import type { KeyValueStorage } from '../storage';

function createMemoryStorage(): KeyValueStorage & {
  read(key: string): string | undefined;
} {
  const values = new Map<string, string>();

  return {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key),
    read: (key) => values.get(key),
  };
}

function createWriteFailingStorage(
  initialEntries: Readonly<Record<string, string>>,
): KeyValueStorage & { read(key: string): string | undefined } {
  const values = new Map(Object.entries(initialEntries));

  return {
    getString: (key) => values.get(key),
    set: () => {
      throw new Error('storage write failed: secret-value');
    },
    remove: (key) => values.delete(key),
    read: (key) => values.get(key),
  };
}

// Mutation caught: reversing navigation direction or omitting modulo arithmetic would break catalog wraparound.
test('moves to adjacent quotes and wraps at both catalog boundaries', () => {
  const store = createAppStore({ storage: createMemoryStorage() });
  const quotes = getAllQuotes();

  expect(store.getState().previousQuote()).toBe(true);
  expect(store.getState().currentQuoteId).toBe(quotes[quotes.length - 1]!.id);
  expect(store.getState().nextQuote()).toBe(true);
  expect(store.getState().currentQuoteId).toBe(quotes[0]!.id);
});

// Mutation caught: binding actions to a separate internal store would make screen consumers observe stale state.
test('updates the exported Zustand hook state through its actions', () => {
  const before = useAppStore.getState().currentQuoteId;

  expect(useAppStore.getState().nextQuote()).toBe(true);
  expect(useAppStore.getState().currentQuoteId).not.toBe(before);
});

// Mutation caught: passing no previous quote to the catalog selector would permit an immediate random repeat.
test('selects a random quote without immediately repeating the current quote', () => {
  const store = createAppStore({
    storage: createMemoryStorage(),
    random: () => 0,
  });
  const initialQuoteId = store.getState().currentQuoteId;

  expect(store.getState().randomQuote()).toBe(true);
  expect(store.getState().currentQuoteId).not.toBe(initialQuoteId);
  expect(store.getState().currentQuoteId).toBe(getAllQuotes()[1]!.id);
});

// Mutation caught: failing to check a quote ID against the catalog would persist a selection screens cannot render.
test('rejects an unknown quote selection without changing persisted state', () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });
  const before = store.getState().currentQuoteId;

  expect(store.getState().selectQuote('gone')).toBe(false);
  expect(store.getState().currentQuoteId).toBe(before);
  expect(storage.read('motivana.app-state')).toBeUndefined();
});

// Mutation caught: publishing state before a storage write fails would leave UI state divergent from the persisted preferences.
test('keeps state and persisted preferences unchanged when a storage write fails', () => {
  const persisted = JSON.stringify({
    version: 1,
    favoriteQuoteIds: [],
    currentQuoteId: getAllQuotes()[0]!.id,
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
  });
  const warnings: string[] = [];
  const storage = createWriteFailingStorage({
    'motivana.app-state': persisted,
  });
  const store = createAppStore({
    storage,
    warn: (message) => warnings.push(message),
  });
  const before = store.getState();

  expect(store.getState().selectPreset('sunrise-drive')).toBe(false);
  expect(store.getState()).toEqual(before);
  expect(storage.read('motivana.app-state')).toBe(persisted);
  expect(warnings).toEqual(['Motivana preferences could not be saved.']);
  expect(warnings.join(' ')).not.toContain('secret-value');
  expect(warnings.join(' ')).not.toContain(persisted);
});

// Mutation caught: accepting an unknown preset or failing to persist valid customization choices would leave previews unrecoverable after relaunch.
test('selects valid presets and persists the random-preset preference', () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });

  expect(store.getState().selectPreset('sunrise-drive')).toBe(true);
  expect(store.getState().selectedPresetId).toBe('sunrise-drive');
  expect(store.getState().selectPreset('gone')).toBe(false);
  expect(store.getState().selectedPresetId).toBe('sunrise-drive');
  expect(store.getState().setRandomizePreset(true)).toBe(true);
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    selectedPresetId: 'sunrise-drive',
    randomizePreset: true,
  });
});

// Mutation caught: failing to persist the next valid favorite state would lose favorite additions and removals on relaunch.
test('toggles a valid quote favorite and persists the deduped result', () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });
  const quoteId = getAllQuotes()[1]!.id;

  expect(store.getState().toggleFavorite(quoteId)).toBe(true);
  expect(store.getState().favoriteQuoteIds).toEqual([quoteId]);
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    favoriteQuoteIds: [quoteId],
  });

  expect(store.getState().toggleFavorite(quoteId)).toBe(true);
  expect(store.getState().favoriteQuoteIds).toEqual([]);
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    favoriteQuoteIds: [],
  });
});

// Mutation caught: enabling favorites-only with no eligible quote would configure automation to fail at runtime.
test('rejects favorites-only rotation when there are no favorites', () => {
  const store = createAppStore({ storage: createMemoryStorage() });

  expect(store.getState().setFavoriteQuotesOnly(true)).toBe(false);
  expect(store.getState().favoriteQuotesOnly).toBe(false);
});

// Mutation caught: storing arbitrary interval or target values would bypass the native automation contract.
test('persists only a valid complete rotation configuration', () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });

  expect(
    store.getState().setRotationConfiguration({
      enabled: true,
      intervalHours: 12,
      target: 'both',
    }),
  ).toBe(true);
  expect(store.getState()).toMatchObject({
    rotationEnabled: true,
    rotationIntervalHours: 12,
    wallpaperTarget: 'both',
  });
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    rotationEnabled: true,
    rotationIntervalHours: 12,
    wallpaperTarget: 'both',
  });

  expect(
    store.getState().setRotationConfiguration({
      enabled: true,
      intervalHours: 8 as 6,
      target: 'desktop' as 'home',
    }),
  ).toBe(false);
  expect(store.getState().rotationIntervalHours).toBe(12);
  expect(store.getState().wallpaperTarget).toBe('both');
});

// Mutation caught: dereferencing a malformed rotation configuration would crash instead of rejecting invalid runtime input.
test('rejects null and undefined rotation configurations without changing state', () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });
  const before = store.getState();
  const setRotationConfiguration = store.getState()
    .setRotationConfiguration as unknown as (configuration: unknown) => boolean;

  expect(setRotationConfiguration(null)).toBe(false);
  expect(setRotationConfiguration(undefined)).toBe(false);
  expect(store.getState()).toEqual(before);
  expect(storage.read('motivana.app-state')).toBeUndefined();
});

// Mutation caught: omitting migration during hydration would restore duplicate and removed favorites into live state.
test('hydrates repaired persisted preferences through the store action', () => {
  const quoteId = getAllQuotes()[2]!.id;
  const storage = createMemoryStorage();
  storage.set(
    'motivana.app-state',
    JSON.stringify({
      version: 1,
      currentQuoteId: quoteId,
      favoriteQuoteIds: [quoteId, quoteId, 'gone'],
      selectedPresetId: 'gone',
    }),
  );
  const store = createAppStore({ storage });

  expect(store.getState().hydrate()).toBe(true);
  expect(store.getState()).toMatchObject({
    currentQuoteId: quoteId,
    favoriteQuoteIds: [quoteId],
    selectedPresetId: 'midnight-focus',
  });
});

// Mutation caught: recording an unknown applied quote would make last-run automation status refer to a missing catalog entry.
test('records only a valid applied quote', () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });
  const quoteId = getAllQuotes()[3]!.id;

  expect(store.getState().recordAppliedQuote('gone')).toBe(false);
  expect(store.getState().lastAppliedQuoteId).toBeUndefined();
  expect(store.getState().recordAppliedQuote(quoteId)).toBe(true);
  expect(store.getState().lastAppliedQuoteId).toBe(quoteId);
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    lastAppliedQuoteId: quoteId,
  });
});
