import { getLocales } from 'expo-localization';
import { getAllQuotes } from '../../features/quotes/quoteRepository';
import { createAppStore } from '../useAppStore';
import type { PersistedAppStateV2 } from '../schema';
import type { KeyValueStorage } from '../storage';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'en-US' }]),
}));
jest.mock('../../services/wallpaperNative', () => ({
  configureRotation: jest.fn(async () => undefined),
}));
// Wraps the real catalog with a jest.fn so individual tests can empty a
// locale's pool for the duration of one test, while every other test keeps
// reading the real, unfiltered catalog through the same mock's default
// implementation.
jest.mock('../../features/quotes/quoteRepository', () => {
  const actual = jest.requireActual('../../features/quotes/quoteRepository');
  return { ...actual, getAllQuotes: jest.fn(actual.getAllQuotes) };
});

const mockedGetLocales = getLocales as jest.Mock;
const mockedGetAllQuotes = getAllQuotes as jest.Mock;
const actualGetAllQuotes = jest.requireActual(
  '../../features/quotes/quoteRepository',
).getAllQuotes as typeof getAllQuotes;

afterEach(() => {
  mockedGetLocales.mockReturnValue([{ languageTag: 'en-US' }]);
  mockedGetAllQuotes.mockImplementation(actualGetAllQuotes);
});

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

// Mutation caught: passing no previous quote to the catalog selector would permit an immediate random repeat.
test('selects a random quote without immediately repeating the current quote', () => {
  const store = createAppStore({
    storage: createMemoryStorage(),
    random: () => 0,
  });
  const initialQuoteId = store.getState().currentQuoteId;

  expect(store.getState().randomQuote()).toBe(true);
  expect(store.getState().currentQuoteId).not.toBe(initialQuoteId);
  expect(store.getState().currentQuoteId).toBe(getAllQuotes('vi')[1]!.id);
});

// Mutation caught: failing to check a quote ID against the catalog would persist a selection screens cannot render.
test('rejects an unknown quote selection without changing persisted state', () => {
  const storage = createMemoryStorage();
  const store = createAppStore({
    storage,
    synchronizeRotation: async () => undefined,
  });
  const before = store.getState().currentQuoteId;

  expect(store.getState().selectQuote('gone')).toBe(false);
  expect(store.getState().currentQuoteId).toBe(before);
  expect(storage.read('motivana.app-state')).toBeUndefined();
});

// Mutation caught: publishing state before a storage write fails would leave UI state divergent from the persisted preferences.
test('keeps state and persisted preferences unchanged when a storage write fails', async () => {
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

  await expect(store.getState().selectPreset('sunrise-drive')).resolves.toBe(
    false,
  );
  expect(store.getState()).toEqual(before);
  expect(storage.read('motivana.app-state')).toBe(persisted);
  expect(warnings).toEqual(['Motivana preferences could not be saved.']);
  expect(warnings.join(' ')).not.toContain('secret-value');
  expect(warnings.join(' ')).not.toContain(persisted);
});

// Mutation caught: accepting an unknown preset or failing to persist valid customization choices would leave previews unrecoverable after relaunch.
test('selects valid presets and persists the random-preset preference', async () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });

  await expect(store.getState().selectPreset('sunrise-drive')).resolves.toBe(
    true,
  );
  expect(store.getState().selectedPresetId).toBe('sunrise-drive');
  await expect(store.getState().selectPreset('gone')).resolves.toBe(false);
  expect(store.getState().selectedPresetId).toBe('sunrise-drive');
  await expect(store.getState().setRandomizePreset(true)).resolves.toBe(true);
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    selectedPresetId: 'sunrise-drive',
    randomizePreset: true,
  });
});

// Mutation caught: failing to persist the next valid favorite state would lose favorite additions and removals on relaunch.
test('toggles a valid quote favorite and persists the deduped result', async () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });
  const quoteId = getAllQuotes()[1]!.id;

  await expect(store.getState().toggleFavorite(quoteId)).resolves.toBe(true);
  expect(store.getState().favoriteQuoteIds).toEqual([quoteId]);
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    favoriteQuoteIds: [quoteId],
  });

  await expect(store.getState().toggleFavorite(quoteId)).resolves.toBe(true);
  expect(store.getState().favoriteQuoteIds).toEqual([]);
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    favoriteQuoteIds: [],
  });
});

// Mutation caught: enabling favorites-only with no eligible quote would configure automation to fail at runtime.
test('rejects favorites-only rotation when there are no favorites', async () => {
  const store = createAppStore({ storage: createMemoryStorage() });

  await expect(store.getState().setFavoriteQuotesOnly(true)).resolves.toBe(
    false,
  );
  expect(store.getState().favoriteQuotesOnly).toBe(false);
});

// Mutation caught: storing arbitrary interval or target values would bypass the native automation contract.
test('persists only a valid complete rotation configuration', async () => {
  const storage = createMemoryStorage();
  const store = createAppStore({
    storage,
    synchronizeRotation: async () => undefined,
  });

  await expect(
    store.getState().setRotationConfiguration({
      enabled: true,
      schedule: 'twice-daily',
      target: 'both',
    }),
  ).resolves.toBe(true);
  expect(store.getState()).toMatchObject({
    rotationEnabled: true,
    rotationSchedule: 'twice-daily',
    wallpaperTarget: 'both',
  });
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    rotationEnabled: true,
    rotationSchedule: 'twice-daily',
    wallpaperTarget: 'both',
  });

  await expect(
    store.getState().setRotationConfiguration({
      enabled: true,
      schedule: 'weekly' as 'daily',
      target: 'desktop' as 'home',
    }),
  ).resolves.toBe(false);
  expect(store.getState().rotationSchedule).toBe('twice-daily');
  expect(store.getState().wallpaperTarget).toBe('both');
});

// Mutation caught: dereferencing a malformed rotation configuration would crash instead of rejecting invalid runtime input.
test('rejects null and undefined rotation configurations without changing state', async () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });
  const before = store.getState();
  const setRotationConfiguration = store.getState()
    .setRotationConfiguration as unknown as (
    configuration: unknown,
  ) => Promise<boolean>;

  await expect(setRotationConfiguration(null)).resolves.toBe(false);
  await expect(setRotationConfiguration(undefined)).resolves.toBe(false);
  expect(store.getState()).toEqual(before);
  expect(storage.read('motivana.app-state')).toBeUndefined();
});

// Mutation caught: omitting migration during hydration would restore duplicate and removed favorites into live state.
test('hydrates repaired persisted preferences through the store action', () => {
  // The default content locale is Vietnamese, so the id has to sit in that
  // pool or hydration repairs it instead of keeping it.
  const quoteId = getAllQuotes('vi')[2]!.id;
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

// Mutation caught: changing a worker-visible preference without configuring native state would make the next process-death rotation use stale choices.
test('synchronizes every worker-visible preference change while rotation is enabled', async () => {
  const storage = createMemoryStorage();
  const synchronizeRotation = jest.fn(async () => undefined);
  const store = createAppStore({ storage, synchronizeRotation });
  const favoriteId = getAllQuotes()[1]!.id;
  store.setState({ rotationEnabled: true });

  await store.getState().selectPreset('sunrise-drive');
  await store.getState().setRandomizePreset(true);
  await store.getState().toggleFavorite(favoriteId);
  await store.getState().setFavoriteQuotesOnly(true);
  await store.getState().setRotationConfiguration({
    enabled: true,
    schedule: 'twice-daily',
    target: 'both',
  });

  expect(synchronizeRotation).toHaveBeenCalledTimes(5);
  expect(synchronizeRotation).toHaveBeenLastCalledWith(
    expect.objectContaining({
      rotationEnabled: true,
      rotationSchedule: 'twice-daily',
      wallpaperTarget: 'both',
      selectedPresetId: 'sunrise-drive',
      randomizePreset: true,
      favoriteQuoteIds: [favoriteId],
      favoriteQuotesOnly: true,
    }),
  );
});

// Mutation caught: publishing a preference after native scheduling rejects would falsely tell the user the worker accepted it.
test('rolls back a worker-visible preference when native synchronization rejects it', async () => {
  const storage = createMemoryStorage();
  const synchronizeRotation = jest.fn(async () => {
    throw new Error('native failure');
  });
  const store = createAppStore({ storage, synchronizeRotation });
  store.setState({ rotationEnabled: true });

  await expect(store.getState().selectPreset('sunrise-drive')).resolves.toBe(
    false,
  );
  expect(store.getState().selectedPresetId).toBe('midnight-focus');
  expect(storage.read('motivana.app-state')).toBeUndefined();
});

// Mutation caught: leaving native work on a new snapshot after local persistence fails would split UI state from process-death worker state.
test('restores the native snapshot when local persistence rejects a synchronized change', async () => {
  const persisted = JSON.stringify({
    version: 1,
    favoriteQuoteIds: [],
    currentQuoteId: getAllQuotes()[0]!.id,
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: true,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
  });
  const snapshots: PersistedAppStateV2[] = [];
  const store = createAppStore({
    storage: createWriteFailingStorage({ 'motivana.app-state': persisted }),
    synchronizeRotation: async (snapshot) => {
      snapshots.push(snapshot);
    },
    warn: () => undefined,
  });

  await expect(store.getState().selectPreset('sunrise-drive')).resolves.toBe(
    false,
  );
  expect(snapshots.map((snapshot) => snapshot.selectedPresetId)).toEqual([
    'sunrise-drive',
    'midnight-focus',
  ]);
  expect(store.getState().selectedPresetId).toBe('midnight-focus');
});

// Mutation caught: reconfiguring native work for ordinary disabled preferences would create work despite automation being off.
test('does not synchronize ordinary preference changes while rotation is disabled', async () => {
  const synchronizeRotation = jest.fn(async () => undefined);
  const store = createAppStore({
    storage: createMemoryStorage(),
    synchronizeRotation,
  });

  await store.getState().selectPreset('sunrise-drive');
  await store.getState().setRandomizePreset(true);
  await store.getState().toggleFavorite(getAllQuotes()[1]!.id);

  expect(synchronizeRotation).not.toHaveBeenCalled();
});

// Mutation caught: ignoring the device language on first launch would show a Vietnamese reader an English interface and English quotes.
test('defaults the interface and quote language to a supported device language', () => {
  mockedGetLocales.mockReturnValue([{ languageTag: 'vi-VN' }]);
  const store = createAppStore({ storage: createMemoryStorage() });

  expect(store.getState().appLocale).toBe('vi');
  expect(store.getState().contentLocale).toBe('vi');
});

// Mutation caught: trusting an unsupported device language directly would produce a locale the app cannot render.
test('falls back to English when the device reports an unsupported language', () => {
  mockedGetLocales.mockReturnValue([{ languageTag: 'fr-FR' }]);
  const store = createAppStore({ storage: createMemoryStorage() });

  expect(store.getState().appLocale).toBe('en');
  expect(store.getState().contentLocale).toBe('vi');
});

// Mutation caught: sharing one locale field would make changing the interface language also change the quote language.
test('changes the interface language without touching the quote language', async () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });
  await store.getState().setContentLocale('en');

  await expect(store.getState().setAppLocale('vi')).resolves.toBe(true);
  expect(store.getState().appLocale).toBe('vi');
  expect(store.getState().contentLocale).toBe('en');
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    appLocale: 'vi',
    contentLocale: 'en',
  });
});

// Mutation caught: accepting an unsupported interface language would render undefined interface strings.
test('rejects an unsupported interface language', async () => {
  const store = createAppStore({ storage: createMemoryStorage() });

  await expect(
    (
      store.getState().setAppLocale as unknown as (
        locale: unknown,
      ) => Promise<boolean>
    )('fr'),
  ).resolves.toBe(false);
  expect(store.getState().appLocale).toBe('en');
});

// Mutation caught: moving the reader into a quote language with an empty catalog would silently strand them on an unreachable pool. The Vietnamese batch now ships content, so the reachable current quote must be kept rather than rejected.
test('accepts a quote language whose catalog has content', async () => {
  const store = createAppStore({ storage: createMemoryStorage() });
  const before = store.getState().currentQuoteId;

  await expect(store.getState().setContentLocale('vi')).resolves.toBe(true);
  expect(store.getState().contentLocale).toBe('vi');
  expect(store.getState().currentQuoteId).toBe(before);
});

// Mutation caught: removing the empty-pool guard would switch the reader into a language with no quotes, leaving the wallpaper and preview screens with nothing to show.
test('refuses to move into a content language whose pool is empty', async () => {
  mockedGetAllQuotes.mockImplementation((locale?: string) =>
    locale === 'vi' ? Object.freeze([]) : actualGetAllQuotes(locale as never),
  );
  const store = createAppStore({ storage: createMemoryStorage() });
  const before = store.getState();

  await expect(store.getState().setContentLocale('vi')).resolves.toBe(false);
  expect(store.getState().contentLocale).toBe(before.contentLocale);
  expect(store.getState().currentQuoteId).toBe(before.currentQuoteId);
});

// Mutation caught: keeping an English-only quote selected after switching to Vietnamese would leave the wallpaper trying to render text that does not exist in the new language.
test('repairs the current quote when it has no text in the new content language', async () => {
  const storage = createMemoryStorage();
  storage.set(
    'motivana.app-state',
    JSON.stringify({ version: 2, currentQuoteId: 'motivation-006' }),
  );
  const store = createAppStore({ storage });

  await expect(store.getState().setContentLocale('vi')).resolves.toBe(true);
  expect(store.getState().currentQuoteId).not.toBe('motivation-006');
  expect(
    getAllQuotes('vi').some(
      (quote) => quote.id === store.getState().currentQuoteId,
    ),
  ).toBe(true);
});

// Mutation caught: always repairing the current quote on a language switch would jump the reader away from a quote they were already reading in the new language.
test('keeps the current quote when it already has text in the new content language', async () => {
  const storage = createMemoryStorage();
  // Read a bilingual quote from the catalogue: a harvest renumbers every ID.
  const bilingual = getAllQuotes('vi').at(0)!.id;
  storage.set(
    'motivana.app-state',
    JSON.stringify({ version: 2, currentQuoteId: bilingual }),
  );
  const store = createAppStore({ storage });

  await expect(store.getState().setContentLocale('vi')).resolves.toBe(true);
  expect(store.getState().currentQuoteId).toBe(bilingual);
});

// Mutation caught: routing either preview option through the rotation queue would
// make a local display choice wait on, and fail with, the native scheduler.
test('persists the preview options without touching the native scheduler', () => {
  const configureRotation = jest.requireMock('../../services/wallpaperNative')
    .configureRotation as jest.Mock;
  configureRotation.mockClear();
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });

  expect(store.getState().setSaveToPhotoLibrary(true)).toBe(true);
  expect(store.getState().setShowSafeGuides(true)).toBe(true);

  expect(store.getState()).toMatchObject({
    saveToPhotoLibrary: true,
    showSafeGuides: true,
  });
  expect(configureRotation).not.toHaveBeenCalled();
  expect(JSON.parse(storage.getString('motivana.app-state')!)).toMatchObject({
    saveToPhotoLibrary: true,
    showSafeGuides: true,
  });
});

// Mutation caught: reporting a failed write as saved would show a toggle the next
// launch silently reverts.
test('reports a rejected preview-option write instead of claiming success', () => {
  const store = createAppStore({
    storage: {
      getString: () => undefined,
      set: () => {
        throw new Error('disk full');
      },
      remove: () => undefined,
    },
    warn: () => undefined,
  });

  expect(store.getState().setShowSafeGuides(true)).toBe(false);
  expect(store.getState().showSafeGuides).toBe(false);
});

// Mutation caught: guarding the setter with isLocale would refuse the every-language choice and leave the setting screen inert.
test('switches into every language and keeps a quote the wider pool still holds', async () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });
  const before = store.getState().currentQuoteId;

  await expect(store.getState().setContentLocale('all')).resolves.toBe(true);
  expect(store.getState().contentLocale).toBe('all');
  expect(store.getState().currentQuoteId).toBe(before);
  expect(JSON.parse(storage.read('motivana.app-state')!)).toMatchObject({
    contentLocale: 'all',
  });
});

// Mutation caught: the trail is excluded from the payload by destructuring, so
// a field added to the store without a thought for toPersistedState would
// quietly start surviving a restart -- and a restored trail describes pairs
// this launch never showed.
test('keeps the deck trail out of the persisted payload', async () => {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage });

  expect(await store.getState().advanceDeck()).toBe(true);

  expect(store.getState().deckHistory).toHaveLength(2);
  const persisted = JSON.parse(storage.read('motivana.app-state')!) as Record<
    string,
    unknown
  >;
  expect(persisted).not.toHaveProperty('deckHistory');
  expect(persisted).not.toHaveProperty('deckCursor');
});
