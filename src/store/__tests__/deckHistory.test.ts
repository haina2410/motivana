import { createDefaultPersistedAppState } from '../schema';
import { useAppStore } from '../useAppStore';
import { setRotationSynchronizer } from '../automationSynchronization';

beforeEach(() => {
  useAppStore.setState({
    ...createDefaultPersistedAppState(),
    deckHistory: [],
    deckCursor: -1,
  });
  setRotationSynchronizer(async () => undefined);
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
