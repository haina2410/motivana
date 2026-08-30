import { createDefaultPersistedAppState } from '../schema';
import { DECK_SYNCHRONIZATION_DELAY_MS, useAppStore } from '../useAppStore';
import { setRotationSynchronizer } from '../automationSynchronization';

// Captured before any test can replace them. setState shallow-merges, so a
// test that stubs a deck action would otherwise leak the stub into the rest
// of the file; a replace would wipe every action instead, because this store
// keeps its actions alongside its data.
const { advanceDeck, rewindDeck } = useAppStore.getState();

beforeEach(() => {
  useAppStore.setState({
    ...createDefaultPersistedAppState(),
    deckHistory: [],
    deckCursor: -1,
    pendingPair: undefined,
    advanceDeck,
    rewindDeck,
  });
  setRotationSynchronizer(async () => undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// Mutation caught: appending on every forward move would make a rewind then a swipe up generate a new pair instead of replaying the one the reader just left.
test('replays the trail forward before generating a new pair', async () => {
  const store = useAppStore.getState();
  await store.advanceDeck();
  await store.advanceDeck();
  const trail = useAppStore.getState().deckHistory;

  await useAppStore.getState().rewindDeck();
  await useAppStore.getState().advanceDeck();

  expect(useAppStore.getState().deckHistory).toEqual(trail);
  expect(useAppStore.getState().deckCursor).toBe(trail.length - 1);
});

// Mutation caught: restoring only the quote leaves the reader on a wallpaper they never saw, because the template moved on without it.
test('a rewind restores both ids of the pair the reader saw', async () => {
  const store = useAppStore.getState();
  await store.advanceDeck();
  const seen = {
    quoteId: useAppStore.getState().currentQuoteId,
    presetId: useAppStore.getState().selectedPresetId,
  };
  await useAppStore.getState().advanceDeck();

  await useAppStore.getState().rewindDeck();

  expect(useAppStore.getState().currentQuoteId).toBe(seen.quoteId);
  expect(useAppStore.getState().selectedPresetId).toBe(seen.presetId);
});

// Mutation caught: rewinding past the first pair would strand the deck on an undefined entry.
test('refuses to rewind past the start of the trail', async () => {
  expect(await useAppStore.getState().rewindDeck()).toBe(false);
});

// Mutation caught: a beforeEach that shallow-merges leaves the previous test's trail in place, so deck tests pass without proving isolation.
test('starts each test with an empty trail', () => {
  expect(useAppStore.getState().deckHistory).toEqual([]);
  expect(useAppStore.getState().deckCursor).toBe(-1);
});

// Mutation caught: a plain commit would leave the Kotlin rotation worker on the
// template the reader swiped past, because selectedPresetId is part of the
// payload it reads. Nothing else in the suite reaches the synchroniser, so
// this is the only test that holds the deck to the payload rule.
test('hands the pair the reader landed on to the rotation worker', async () => {
  const payloads: { currentQuoteId: string; selectedPresetId: string }[] = [];
  setRotationSynchronizer(async (state) => {
    payloads.push({
      currentQuoteId: state.currentQuoteId,
      selectedPresetId: state.selectedPresetId,
    });
  });
  useAppStore.setState({ rotationEnabled: true });
  jest.useFakeTimers();

  await useAppStore.getState().advanceDeck();
  await jest.advanceTimersByTimeAsync(DECK_SYNCHRONIZATION_DELAY_MS);

  expect(payloads).toEqual([
    {
      currentQuoteId: useAppStore.getState().currentQuoteId,
      selectedPresetId: useAppStore.getState().selectedPresetId,
    },
  ]);
});

// Mutation caught: synchronising every swipe cancels and re-fires the native
// rotation worker on each one, so the reader's chosen cadence never elapses.
test('synchronises once for a burst of swipes, on the pair the deck settles on', async () => {
  const payloads: string[] = [];
  setRotationSynchronizer(async (state) => {
    payloads.push(state.selectedPresetId);
  });
  useAppStore.setState({ rotationEnabled: true });
  jest.useFakeTimers();

  for (let swipe = 0; swipe < 10; swipe += 1) {
    await useAppStore.getState().advanceDeck();
    await jest.advanceTimersByTimeAsync(DECK_SYNCHRONIZATION_DELAY_MS / 4);
  }
  await jest.advanceTimersByTimeAsync(DECK_SYNCHRONIZATION_DELAY_MS);

  expect(payloads).toEqual([useAppStore.getState().selectedPresetId]);
});

// Mutation caught: reading the trail before an await and writing it after lets
// two flicks both act on the same cursor, so the second overwrites the first
// and a swipe down lands on a wallpaper the reader never saw.
test('keeps both pairs when two swipes are in flight at once', async () => {
  const start = {
    quoteId: useAppStore.getState().currentQuoteId,
    presetId: useAppStore.getState().selectedPresetId,
  };

  const [first, second] = await Promise.all([
    useAppStore.getState().advanceDeck(),
    useAppStore.getState().advanceDeck(),
  ]);

  expect(first && second).toBe(true);
  const trail = useAppStore.getState().deckHistory;
  expect(trail).toHaveLength(3);
  expect(trail[0]).toEqual(start);
  expect(useAppStore.getState().deckCursor).toBe(2);
  // The reader saw both, so both are still walkable backwards.
  await useAppStore.getState().rewindDeck();
  expect(useAppStore.getState().currentQuoteId).toBe(trail[1]!.quoteId);
  expect(useAppStore.getState().selectedPresetId).toBe(trail[1]!.presetId);
});
