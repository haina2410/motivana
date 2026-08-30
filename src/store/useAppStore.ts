import { create } from 'zustand';
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';

import {
  getAllQuotes,
  quoteInLocale,
  selectRandomQuote,
} from '../features/quotes/quoteRepository';
import {
  isContentLocale,
  isLocale,
  type ContentLocale,
  type Locale,
} from '../features/i18n/locale';
import { getAllTemplates } from '../features/wallpaper/presetRepository';
import {
  hydrateAppState,
  isValidPresetId,
  isValidQuoteId,
  isValidRotationSchedule,
  isValidWallpaperTarget,
  serializePersistedAppState,
  type PersistedAppStateV2,
  type SafeWarningReporter,
  type WallpaperTarget,
} from './schema';
import {
  appStorage,
  APP_STATE_STORAGE_KEY,
  type KeyValueStorage,
} from './storage';
import { synchronizeRotationState } from './automationSynchronization';
import type { RotationSchedule } from '../features/rotation/schedule';

export interface RotationConfiguration {
  enabled: boolean;
  schedule: RotationSchedule;
  target: WallpaperTarget;
  favoriteQuotesOnly?: boolean;
  randomizePreset?: boolean;
}

/** One step of the deck: the quote and the template the reader saw together. */
export interface DeckPair {
  quoteId: string;
  presetId: string;
}

export interface DeckTrail {
  history: readonly DeckPair[];
  cursor: number;
}

export interface AppState extends PersistedAppStateV2 {
  randomQuote(): boolean;
  selectQuote(quoteId: string): boolean;
  toggleFavorite(quoteId: string): Promise<boolean>;
  selectPreset(presetId: string): Promise<boolean>;
  setRandomizePreset(randomizePreset: boolean): Promise<boolean>;
  setAppLocale(locale: Locale): Promise<boolean>;
  setContentLocale(locale: ContentLocale): Promise<boolean>;
  setFavoriteQuotesOnly(favoriteQuotesOnly: boolean): Promise<boolean>;
  setSaveToPhotoLibrary(saveToPhotoLibrary: boolean): boolean;
  setShowSafeGuides(showSafeGuides: boolean): boolean;
  setRotationConfiguration(
    configuration: RotationConfiguration,
  ): Promise<boolean>;
  recordAppliedQuote(quoteId: string): boolean;
  hydrate(): boolean;
  deckHistory: readonly DeckPair[];
  deckCursor: number;
  // The pair a swipe up would commit, rolled ahead of time so the incoming
  // card has a wallpaper to show while the reader's finger is still moving it
  // into view, rather than only once the swipe completes.
  pendingPair: DeckPair | undefined;
  advanceDeck(): Promise<boolean>;
  rewindDeck(): Promise<boolean>;
  primePendingPair(): void;
}

/**
 * The part of the recorded trail that still describes what the reader saw.
 *
 * Something outside the deck (selectQuote, selectPreset, a locale switch,
 * hydrate, a raw setState in a test) can move the on-screen pair without going
 * through advanceDeck/rewindDeck. When that happens the recorded trail no
 * longer describes what the reader actually saw, so treat it as a fresh deck
 * rather than replaying pairs that do not match the screen.
 *
 * Exported because Home draws its neighbour cards from the same trail: reading
 * deckHistory raw would show a card the pager then refuses to move to.
 */
export function currentDeckTrail(
  state: Pick<
    AppState,
    'deckHistory' | 'deckCursor' | 'currentQuoteId' | 'selectedPresetId'
  >,
): DeckTrail {
  const onScreen = state.deckHistory[state.deckCursor];
  const isCurrent =
    onScreen !== undefined &&
    onScreen.quoteId === state.currentQuoteId &&
    onScreen.presetId === state.selectedPresetId;
  return isCurrent
    ? { history: state.deckHistory, cursor: state.deckCursor }
    : { history: [], cursor: -1 };
}

/**
 * The pending pair only if it still describes what a swipe up would actually
 * commit.
 *
 * Something outside the deck can move currentQuoteId or contentLocale out
 * from under it (selectQuote, a locale switch, hydrate, a raw setState in a
 * test) without going through advanceDeck. When that happens the pending
 * card would either repeat the quote already on screen or hold text the
 * current content language cannot show, so treat it as gone rather than
 * showing -- or committing -- a pair the deck would not actually serve.
 *
 * Exported for the same reason as currentDeckTrail: Home draws the forward
 * neighbour from this, so it never shows a card advanceDeck would refuse to
 * commit as-is.
 */
export function currentPendingPair(
  state: Pick<AppState, 'pendingPair' | 'currentQuoteId' | 'contentLocale'>,
): DeckPair | undefined {
  const pending = state.pendingPair;
  if (!pending) return undefined;
  if (pending.quoteId === state.currentQuoteId) return undefined;
  if (!quoteInLocale(pending.quoteId, state.contentLocale)) return undefined;
  return pending;
}

/**
 * How long the deck waits for the reader to stop swiping before it hands the
 * pair they landed on to the native rotation worker. Long enough to swallow a
 * burst of flicks, short enough that a reader who swipes once and puts the
 * phone down still has the worker on the wallpaper they left.
 */
export const DECK_SYNCHRONIZATION_DELAY_MS = 400;

export interface CreateAppStoreOptions {
  storage?: KeyValueStorage;
  random?: () => number;
  warn?: SafeWarningReporter;
  synchronizeRotation?: (state: PersistedAppStateV2) => Promise<void>;
}

function persist(storage: KeyValueStorage, state: PersistedAppStateV2): void {
  storage.set(APP_STATE_STORAGE_KEY, serializePersistedAppState(state));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createAppState(
  options: CreateAppStoreOptions,
): StateCreator<AppState, [], [], AppState> {
  const storage = options.storage ?? appStorage;
  const random = options.random ?? Math.random;
  const warn = options.warn ?? console.warn;
  const synchronizeRotation =
    options.synchronizeRotation ?? synchronizeRotationState;

  return (set, get) => {
    const commit = (next: PersistedAppStateV2): boolean => {
      try {
        persist(storage, next);
      } catch {
        warn('Motivana preferences could not be saved.');
        return false;
      }
      set(next);
      return true;
    };
    let automationQueue = Promise.resolve();
    const commitAutomation = (
      update: (state: PersistedAppStateV2) => PersistedAppStateV2 | undefined,
      forceSynchronization = false,
    ): Promise<boolean> => {
      const operation = async () => {
        const previous = toPersistedState(get());
        const next = update(previous);
        if (next === undefined) return false;
        const shouldSynchronize =
          forceSynchronization ||
          previous.rotationEnabled ||
          next.rotationEnabled;
        if (shouldSynchronize) {
          try {
            await synchronizeRotation(next);
          } catch {
            return false;
          }
        }
        try {
          persist(storage, next);
        } catch {
          if (shouldSynchronize) {
            try {
              await synchronizeRotation(previous);
            } catch {
              warn('Motivana automation preferences could not be restored.');
            }
          }
          warn('Motivana preferences could not be saved.');
          return false;
        }
        set(next);
        return true;
      };
      const result = automationQueue.then(operation, operation);
      automationQueue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    };
    const randomTemplateId = (currentId: string): string => {
      const pool = getAllTemplates().filter(
        (template) => template.id !== currentId,
      );
      if (pool.length === 0) return currentId;
      return pool[Math.floor(random() * pool.length)]!.id;
    };
    // A fresh candidate pair, rolled from whatever the reader is currently
    // looking at. No persistence, no native sync -- rolling a candidate is
    // only ever a read, committing it is the side-effecting step.
    const rollPair = (from: {
      contentLocale: ContentLocale;
      currentQuoteId: string;
      selectedPresetId: string;
    }): DeckPair => ({
      quoteId: selectRandomQuote({
        locale: from.contentLocale,
        previousId: from.currentQuoteId,
        random,
      }).id,
      presetId: randomTemplateId(from.selectedPresetId),
    });
    // The deck's native round trip, coalesced.
    //
    // selectedPresetId is part of the payload the Kotlin rotation worker
    // reads, so a swipe has to reach native or the scheduled wallpaper stays
    // on the template the reader swiped past. But the worker is re-enqueued
    // on every configureRotation call, so synchronising each swipe of a burst
    // would restart the schedule ten times over and block the card behind ten
    // native round trips. One synchronisation once the deck settles carries
    // the pair the reader stopped on, which is the only one that matters.
    let deckSynchronization: ReturnType<typeof setTimeout> | undefined;
    const flushDeckSynchronization = (): Promise<boolean> => {
      const operation = async () => {
        const state = toPersistedState(get());
        if (!state.rotationEnabled) return true;
        try {
          await synchronizeRotation(state);
          return true;
        } catch {
          return false;
        }
      };
      // The same queue every other automation write uses, so a settings change
      // and the deck cannot hand native two payloads out of order.
      const result = automationQueue.then(operation, operation);
      automationQueue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    };
    // The local write is immediate and unconditional: the card on screen must
    // never wait on native to change.
    const applyDeckPair = (pair: {
      quoteId: string;
      presetId: string;
    }): boolean => {
      const applied = commit({
        ...toPersistedState(get()),
        currentQuoteId: pair.quoteId,
        selectedPresetId: pair.presetId,
      });
      if (!applied) return false;
      if (deckSynchronization !== undefined) clearTimeout(deckSynchronization);
      deckSynchronization = setTimeout(() => {
        deckSynchronization = undefined;
        void flushDeckSynchronization();
      }, DECK_SYNCHRONIZATION_DELAY_MS);
      return true;
    };
    return {
      ...hydrateAppState(storage, warn),
      randomQuote: () => {
        const state = get();
        const quote = selectRandomQuote({
          locale: state.contentLocale,
          previousId: state.currentQuoteId,
          random,
        });
        return commit({ ...toPersistedState(state), currentQuoteId: quote.id });
      },
      selectQuote: (quoteId) =>
        isValidQuoteId(quoteId)
          ? commit({ ...toPersistedState(get()), currentQuoteId: quoteId })
          : false,
      toggleFavorite: (quoteId) => {
        if (!isValidQuoteId(quoteId)) {
          return Promise.resolve(false);
        }
        return commitAutomation((state) => {
          const isFavorite = state.favoriteQuoteIds.includes(quoteId);
          if (
            isFavorite &&
            state.favoriteQuotesOnly &&
            state.favoriteQuoteIds.length === 1
          ) {
            return undefined;
          }
          const favoriteQuoteIds = isFavorite
            ? state.favoriteQuoteIds.filter((id) => id !== quoteId)
            : [...state.favoriteQuoteIds, quoteId];
          return { ...state, favoriteQuoteIds };
        });
      },
      selectPreset: (presetId) =>
        isValidPresetId(presetId)
          ? commitAutomation((state) => ({
              ...state,
              selectedPresetId: presetId,
            }))
          : Promise.resolve(false),
      setRandomizePreset: (randomizePreset) =>
        typeof randomizePreset === 'boolean'
          ? commitAutomation((state) => ({ ...state, randomizePreset }))
          : Promise.resolve(false),
      setAppLocale: (locale) =>
        isLocale(locale)
          ? commitAutomation((state) => ({ ...state, appLocale: locale }))
          : Promise.resolve(false),
      setContentLocale: (locale) =>
        isContentLocale(locale)
          ? commitAutomation((state) => {
              const pool = getAllQuotes(locale);
              if (pool.length === 0) {
                return undefined;
              }
              const currentStaysValid = pool.some(
                (quote) => quote.id === state.currentQuoteId,
              );
              return {
                ...state,
                contentLocale: locale,
                currentQuoteId: currentStaysValid
                  ? state.currentQuoteId
                  : pool[0]!.id,
              };
            })
          : Promise.resolve(false),
      setFavoriteQuotesOnly: (favoriteQuotesOnly) => {
        if (typeof favoriteQuotesOnly !== 'boolean')
          return Promise.resolve(false);
        return commitAutomation((state) => {
          if (favoriteQuotesOnly && state.favoriteQuoteIds.length === 0) {
            return undefined;
          }
          return { ...state, favoriteQuotesOnly };
        });
      },
      // Neither option reaches the native rotation worker, so a plain commit is
      // enough: there is no schedule to keep in step.
      setSaveToPhotoLibrary: (saveToPhotoLibrary) =>
        typeof saveToPhotoLibrary === 'boolean'
          ? commit({ ...toPersistedState(get()), saveToPhotoLibrary })
          : false,
      setShowSafeGuides: (showSafeGuides) =>
        typeof showSafeGuides === 'boolean'
          ? commit({ ...toPersistedState(get()), showSafeGuides })
          : false,
      setRotationConfiguration: (configuration) => {
        if (
          !isRecord(configuration) ||
          typeof configuration.enabled !== 'boolean' ||
          !isValidRotationSchedule(configuration.schedule) ||
          !isValidWallpaperTarget(configuration.target) ||
          (configuration.favoriteQuotesOnly !== undefined &&
            typeof configuration.favoriteQuotesOnly !== 'boolean') ||
          (configuration.randomizePreset !== undefined &&
            typeof configuration.randomizePreset !== 'boolean')
        ) {
          return Promise.resolve(false);
        }
        return commitAutomation((state) => {
          const favoriteQuotesOnly =
            configuration.favoriteQuotesOnly ?? state.favoriteQuotesOnly;
          if (favoriteQuotesOnly && state.favoriteQuoteIds.length === 0) {
            return undefined;
          }
          return {
            ...state,
            rotationEnabled: configuration.enabled,
            rotationSchedule: configuration.schedule,
            wallpaperTarget: configuration.target,
            favoriteQuotesOnly,
            randomizePreset:
              configuration.randomizePreset ?? state.randomizePreset,
          };
        }, true);
      },
      recordAppliedQuote: (quoteId) =>
        isValidQuoteId(quoteId)
          ? commit({ ...toPersistedState(get()), lastAppliedQuoteId: quoteId })
          : false,
      hydrate: () => commit(hydrateAppState(storage)),
      // Session state on purpose. The trail exists so a swipe down restores the
      // exact pair the reader saw, which a random pick cannot reconstruct. It
      // has no meaning across launches, so it stays out of the persisted schema.
      deckHistory: [],
      deckCursor: -1,
      pendingPair: undefined,
      // The first swipe of a session has nothing recorded ahead of it, so
      // without a candidate the pager clamps and the deck cannot move at all.
      // Home calls this whenever the forward card is missing. Session state
      // only: rolling a candidate persists nothing and tells native nothing,
      // because only committing it does.
      primePendingPair: () => {
        const state = get();
        if (currentPendingPair(state)) return;
        set({ pendingPair: rollPair(state) });
      },
      // Both moves read the trail and write it back without awaiting in
      // between, so two swipes in flight cannot both act on the same cursor
      // and drop the pair the first one recorded.
      advanceDeck: async () => {
        const state = get();
        const { history, cursor } = currentDeckTrail(state);
        const replay = history[cursor + 1];
        if (replay) {
          const applied = applyDeckPair(replay);
          if (applied) set({ deckHistory: history, deckCursor: cursor + 1 });
          return applied;
        }
        // At the head of the trail the pair to commit was already rolled
        // ahead of the swipe, so the incoming card had a wallpaper to track
        // the finger with. Commit that exact pair -- re-rolling here would
        // show the reader one card while dragging and commit a different one.
        const pair = currentPendingPair(state) ?? rollPair(state);
        const applied = applyDeckPair(pair);
        if (!applied) return false;
        const trail =
          cursor === -1
            ? [
                {
                  quoteId: state.currentQuoteId,
                  presetId: state.selectedPresetId,
                },
                pair,
              ]
            : [...history.slice(0, cursor + 1), pair];
        // Roll the next candidate immediately, from the pair that is now on
        // screen, so the following swipe up has a card to track with too.
        set({
          deckHistory: trail,
          deckCursor: trail.length - 1,
          pendingPair: rollPair({
            contentLocale: state.contentLocale,
            currentQuoteId: pair.quoteId,
            selectedPresetId: pair.presetId,
          }),
        });
        return true;
      },
      rewindDeck: async () => {
        const state = get();
        const { history, cursor } = currentDeckTrail(state);
        const previous = history[cursor - 1];
        if (!previous) return false;
        const applied = applyDeckPair(previous);
        if (applied) set({ deckHistory: history, deckCursor: cursor - 1 });
        return applied;
      },
    };
  };
}

function toPersistedState(state: AppState): PersistedAppStateV2 {
  const {
    version,
    appLocale,
    contentLocale,
    favoriteQuoteIds,
    currentQuoteId,
    lastAppliedQuoteId,
    selectedPresetId,
    randomizePreset,
    favoriteQuotesOnly,
    rotationEnabled,
    rotationSchedule,
    wallpaperTarget,
    saveToPhotoLibrary,
    showSafeGuides,
  } = state;

  return {
    version,
    appLocale,
    contentLocale,
    favoriteQuoteIds,
    currentQuoteId,
    ...(lastAppliedQuoteId === undefined ? {} : { lastAppliedQuoteId }),
    selectedPresetId,
    randomizePreset,
    favoriteQuotesOnly,
    rotationEnabled,
    rotationSchedule,
    wallpaperTarget,
    saveToPhotoLibrary,
    showSafeGuides,
  };
}

export function createAppStore(
  options: CreateAppStoreOptions = {},
): StoreApi<AppState> {
  return createStore<AppState>()(createAppState(options));
}

export const useAppStore = create<AppState>()(
  createAppState({ storage: appStorage }),
);
