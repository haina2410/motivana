import type { ContentLocale } from '../../../src/features/i18n/locale';

export type WallpaperTarget = 'home' | 'lock' | 'both';

export interface WallpaperCapabilities {
  supportsHome: boolean;
  supportsLock: boolean;
}

export interface RotationStatus {
  enabled: boolean;
  state: 'disabled' | 'scheduled' | 'running' | 'succeeded' | 'failed';
  lastAppliedAt?: number;
  lastQuoteId?: string;
  lastPresetId?: string;
  errorCode?: string;
  intervalHours?: 1 | 12 | 24;
  anchorHour?: number;
  target?: WallpaperTarget;
}

export interface ConfigureRotationOptions {
  enabled: boolean;
  intervalHours: 1 | 12 | 24;
  /**
   * Local clock hour the first run aims for. Omitted by `hourly`, which starts
   * a period from now instead of waiting for a particular hour.
   */
  anchorHour?: number;
  target: WallpaperTarget;
  selectedPresetId: string;
  randomizePreset: boolean;
  favoriteQuoteIds: string[];
  favoriteQuotesOnly: boolean;
  contentLocale: ContentLocale;
}

export interface MotivanaWallpaperNativeContract {
  getCapabilities(): Promise<WallpaperCapabilities>;
  setWallpaper(uri: string, target: WallpaperTarget): Promise<void>;
  configureRotation(options: ConfigureRotationOptions): Promise<void>;
  getRotationStatus(): Promise<RotationStatus>;
  runRotationNow(): Promise<void>;
}
