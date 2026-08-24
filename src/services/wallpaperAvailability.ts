import type { WallpaperTarget } from '../store/schema';
import { getRotationStatus, getWallpaperCapabilities } from './wallpaperNative';

export type WallpaperCapabilities =
  | {
      kind: 'available';
      supportedTargets: Readonly<Record<WallpaperTarget, boolean>>;
    }
  | {
      kind: 'unavailable';
      supportedTargets: Readonly<Record<WallpaperTarget, false>>;
    };

export type WallpaperAutomationStatus = {
  kind: 'available';
  state: 'disabled' | 'scheduled' | 'running' | 'succeeded' | 'failed';
  lastAppliedAt?: number;
  lastQuoteId?: string;
  errorCode?: string;
  intervalHours?: 6 | 12 | 24;
  target?: WallpaperTarget;
};

export interface WallpaperAutomationAvailability {
  capabilities: WallpaperCapabilities;
  status: WallpaperAutomationStatus;
}

export const wallpaperAutomationFallback: WallpaperAutomationAvailability = {
  capabilities: {
    kind: 'unavailable',
    supportedTargets: { home: false, lock: false, both: false },
  },
  status: { kind: 'available', state: 'disabled' },
};

/**
 * Capabilities and worker status both come from the Android boundary.
 */
export async function getWallpaperAutomationAvailability(): Promise<WallpaperAutomationAvailability> {
  const [capabilities, nativeStatus] = await Promise.all([
    getWallpaperCapabilities(),
    getRotationStatus(),
  ]);
  const status = nativeStatus ?? { enabled: false, state: 'disabled' as const };
  return {
    capabilities: {
      kind: 'available',
      supportedTargets: {
        home: capabilities.supportsHome,
        lock: capabilities.supportsLock,
        both: capabilities.supportsHome && capabilities.supportsLock,
      },
    },
    status: {
      kind: 'available',
      state: status.state,
      lastAppliedAt: status.lastAppliedAt,
      lastQuoteId: status.lastQuoteId,
      errorCode: status.errorCode,
      intervalHours: status.intervalHours,
      target: status.target,
    },
  };
}

export function isWallpaperTargetAvailable(
  target: WallpaperTarget,
  capabilities: WallpaperCapabilities,
): boolean {
  return capabilities.supportedTargets[target];
}
