import { create } from 'zustand';
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';

import {
  getAdjacentQuote,
  getAllQuotes,
  selectRandomQuote,
} from '../features/quotes/quoteRepository';
import { isLocale, type Locale } from '../features/i18n/locale';
import {
  hydrateAppState,
  isValidPresetId,
  isValidQuoteId,
  isValidRotationIntervalHours,
  isValidWallpaperTarget,
  serializePersistedAppState,
  type PersistedAppStateV2,
  type RotationIntervalHours,
  type SafeWarningReporter,
  type WallpaperTarget,
} from './schema';
import {
  appStorage,
  APP_STATE_STORAGE_KEY,
  type KeyValueStorage,
} from './storage';
import { synchronizeRotationState } from './automationSynchronization';

export interface RotationConfiguration {
  enabled: boolean;
  intervalHours: RotationIntervalHours;
  target: WallpaperTarget;
  favoriteQuotesOnly?: boolean;
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
  setContentLocale(locale: Locale): Promise<boolean>;
  setFavoriteQuotesOnly(favoriteQuotesOnly: boolean): Promise<boolean>;
  setSaveToPhotoLibrary(saveToPhotoLibrary: boolean): boolean;
  setShowSafeGuides(showSafeGuides: boolean): boolean;
  setRotationConfiguration(
    configuration: RotationConfiguration,
  ): Promise<boolean>;
  recordAppliedQuote(quoteId: string): boolean;
  hydrate(): boolean;
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
        isLocale(locale)
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
          !isValidRotationIntervalHours(configuration.intervalHours) ||
          !isValidWallpaperTarget(configuration.target) ||
          (configuration.favoriteQuotesOnly !== undefined &&
            typeof configuration.favoriteQuotesOnly !== 'boolean')
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
            rotationIntervalHours: configuration.intervalHours,
            wallpaperTarget: configuration.target,
            favoriteQuotesOnly,
          };
        }, true);
      },
      recordAppliedQuote: (quoteId) =>
        isValidQuoteId(quoteId)
          ? commit({ ...toPersistedState(get()), lastAppliedQuoteId: quoteId })
          : false,
      hydrate: () => commit(hydrateAppState(storage)),
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
    rotationIntervalHours,
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
    rotationIntervalHours,
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
