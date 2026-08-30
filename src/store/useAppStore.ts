import { create } from 'zustand';
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';

import {
  getAdjacentQuote,
  getAllQuotes,
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

export interface AppState extends PersistedAppStateV2 {
  nextQuote(): boolean;
  previousQuote(): boolean;
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
  deckHistory: readonly { quoteId: string; presetId: string }[];
  deckCursor: number;
  advanceDeck(): Promise<boolean>;
  rewindDeck(): Promise<boolean>;
}

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
    // Both ids move together through commitAutomation: selectedPresetId is
    // part of the payload the Kotlin rotation worker reads, and a plain
    // commit would leave the scheduled wallpaper on the template the reader
    // swiped past.
    const applyDeckPair = (pair: {
      quoteId: string;
      presetId: string;
    }): Promise<boolean> =>
      commitAutomation((state) => ({
        ...state,
        currentQuoteId: pair.quoteId,
        selectedPresetId: pair.presetId,
      }));
    // Something outside the deck (selectQuote, a locale switch, hydrate, a
    // raw setState in a test) can move the on-screen pair without going
    // through advanceDeck/rewindDeck. When that happens the recorded trail no
    // longer describes what the reader actually saw, so treat it as a fresh
    // deck rather than replaying pairs that do not match the screen.
    const currentDeckTrail = (
      state: AppState,
    ): {
      history: readonly { quoteId: string; presetId: string }[];
      cursor: number;
    } => {
      const onScreen = state.deckHistory[state.deckCursor];
      const isCurrent =
        onScreen !== undefined &&
        onScreen.quoteId === state.currentQuoteId &&
        onScreen.presetId === state.selectedPresetId;
      return isCurrent
        ? { history: state.deckHistory, cursor: state.deckCursor }
        : { history: [], cursor: -1 };
    };

    return {
      ...hydrateAppState(storage, warn),
      nextQuote: () => {
        const state = get();
        const next = getAdjacentQuote(
          state.currentQuoteId,
          'next',
          state.contentLocale,
        );
        return next === undefined
          ? false
          : commit({ ...toPersistedState(get()), currentQuoteId: next.id });
      },
      previousQuote: () => {
        const state = get();
        const previous = getAdjacentQuote(
          state.currentQuoteId,
          'previous',
          state.contentLocale,
        );
        return previous === undefined
          ? false
          : commit({ ...toPersistedState(get()), currentQuoteId: previous.id });
      },
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
      advanceDeck: async () => {
        const state = get();
        const { history, cursor } = currentDeckTrail(state);
        const replay = history[cursor + 1];
        if (replay) {
          const applied = await applyDeckPair(replay);
          if (applied) set({ deckHistory: history, deckCursor: cursor + 1 });
          return applied;
        }
        const pair = {
          quoteId: selectRandomQuote({
            locale: state.contentLocale,
            previousId: state.currentQuoteId,
            random,
          }).id,
          presetId: randomTemplateId(state.selectedPresetId),
        };
        const applied = await applyDeckPair(pair);
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
        set({ deckHistory: trail, deckCursor: trail.length - 1 });
        return true;
      },
      rewindDeck: async () => {
        const state = get();
        const { history, cursor } = currentDeckTrail(state);
        const previous = history[cursor - 1];
        if (!previous) return false;
        const applied = await applyDeckPair(previous);
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
