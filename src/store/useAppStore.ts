import { create } from 'zustand';
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';

import {
  getAdjacentQuote,
  selectRandomQuote,
} from '../features/quotes/quoteRepository';
import {
  hydrateAppState,
  isValidPresetId,
  isValidQuoteId,
  isValidRotationIntervalHours,
  isValidWallpaperTarget,
  serializePersistedAppState,
  type PersistedAppStateV1,
  type RotationIntervalHours,
  type SafeWarningReporter,
  type WallpaperTarget,
} from './schema';
import {
  appStorage,
  APP_STATE_STORAGE_KEY,
  type KeyValueStorage,
} from './storage';

export interface RotationConfiguration {
  enabled: boolean;
  intervalHours: RotationIntervalHours;
  target: WallpaperTarget;
}

export interface AppState extends PersistedAppStateV1 {
  nextQuote(): boolean;
  previousQuote(): boolean;
  randomQuote(): boolean;
  selectQuote(quoteId: string): boolean;
  toggleFavorite(quoteId: string): boolean;
  selectPreset(presetId: string): boolean;
  setRandomizePreset(randomizePreset: boolean): boolean;
  setFavoriteQuotesOnly(favoriteQuotesOnly: boolean): boolean;
  setRotationConfiguration(configuration: RotationConfiguration): boolean;
  recordAppliedQuote(quoteId: string): boolean;
  hydrate(): boolean;
}

export interface CreateAppStoreOptions {
  storage?: KeyValueStorage;
  random?: () => number;
  warn?: SafeWarningReporter;
}

function persist(storage: KeyValueStorage, state: PersistedAppStateV1): void {
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

  return (set, get) => {
    const commit = (next: PersistedAppStateV1): boolean => {
      try {
        persist(storage, next);
      } catch {
        warn('Motivana preferences could not be saved.');
        return false;
      }
      set(next);
      return true;
    };

    return {
      ...hydrateAppState(storage, warn),
      nextQuote: () => {
        const next = getAdjacentQuote(get().currentQuoteId, 'next');
        return next === undefined
          ? false
          : commit({ ...toPersistedState(get()), currentQuoteId: next.id });
      },
      previousQuote: () => {
        const previous = getAdjacentQuote(get().currentQuoteId, 'previous');
        return previous === undefined
          ? false
          : commit({ ...toPersistedState(get()), currentQuoteId: previous.id });
      },
      randomQuote: () => {
        const state = get();
        const quote = selectRandomQuote({
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
        const state = get();
        if (!isValidQuoteId(quoteId)) {
          return false;
        }
        const isFavorite = state.favoriteQuoteIds.includes(quoteId);
        if (
          isFavorite &&
          state.favoriteQuotesOnly &&
          state.favoriteQuoteIds.length === 1
        ) {
          return false;
        }
        const favoriteQuoteIds = isFavorite
          ? state.favoriteQuoteIds.filter((id) => id !== quoteId)
          : [...state.favoriteQuoteIds, quoteId];
        return commit({ ...toPersistedState(state), favoriteQuoteIds });
      },
      selectPreset: (presetId) =>
        isValidPresetId(presetId)
          ? commit({ ...toPersistedState(get()), selectedPresetId: presetId })
          : false,
      setRandomizePreset: (randomizePreset) =>
        typeof randomizePreset === 'boolean'
          ? commit({ ...toPersistedState(get()), randomizePreset })
          : false,
      setFavoriteQuotesOnly: (favoriteQuotesOnly) => {
        const state = get();
        if (
          typeof favoriteQuotesOnly !== 'boolean' ||
          (favoriteQuotesOnly && state.favoriteQuoteIds.length === 0)
        ) {
          return false;
        }
        return commit({ ...toPersistedState(state), favoriteQuotesOnly });
      },
      setRotationConfiguration: (configuration) => {
        if (
          !isRecord(configuration) ||
          typeof configuration.enabled !== 'boolean' ||
          !isValidRotationIntervalHours(configuration.intervalHours) ||
          !isValidWallpaperTarget(configuration.target)
        ) {
          return false;
        }
        return commit({
          ...toPersistedState(get()),
          rotationEnabled: configuration.enabled,
          rotationIntervalHours: configuration.intervalHours,
          wallpaperTarget: configuration.target,
        });
      },
      recordAppliedQuote: (quoteId) =>
        isValidQuoteId(quoteId)
          ? commit({ ...toPersistedState(get()), lastAppliedQuoteId: quoteId })
          : false,
      hydrate: () => commit(hydrateAppState(storage)),
    };
  };
}

function toPersistedState(state: AppState): PersistedAppStateV1 {
  const {
    version,
    favoriteQuoteIds,
    currentQuoteId,
    lastAppliedQuoteId,
    selectedPresetId,
    randomizePreset,
    favoriteQuotesOnly,
    rotationEnabled,
    rotationIntervalHours,
    wallpaperTarget,
  } = state;

  return {
    version,
    favoriteQuoteIds,
    currentQuoteId,
    ...(lastAppliedQuoteId === undefined ? {} : { lastAppliedQuoteId }),
    selectedPresetId,
    randomizePreset,
    favoriteQuotesOnly,
    rotationEnabled,
    rotationIntervalHours,
    wallpaperTarget,
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
