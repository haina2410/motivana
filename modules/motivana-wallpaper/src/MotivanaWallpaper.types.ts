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
}

export interface ConfigureRotationOptions {
  enabled: boolean;
  intervalHours: 6 | 12 | 24;
  target: WallpaperTarget;
  selectedPresetId: string;
  randomizePreset: boolean;
  favoriteQuoteIds: string[];
  favoriteQuotesOnly: boolean;
}

export interface MotivanaWallpaperNativeContract {
  getCapabilities(): Promise<WallpaperCapabilities>;
  setWallpaper(uri: string, target: WallpaperTarget): Promise<void>;
  configureRotation(options: ConfigureRotationOptions): Promise<void>;
  getRotationStatus(): Promise<RotationStatus>;
  runRotationNow(): Promise<void>;
}
