import type { WallpaperTarget } from '../store/schema';
import { getWallpaperCapabilities } from './wallpaperNative';

export type WallpaperCapabilities =
  | {
      kind: 'available';
      supportedTargets: Readonly<Record<WallpaperTarget, boolean>>;
    }
  | {
      kind: 'unavailable';
      supportedTargets: Readonly<Record<WallpaperTarget, false>>;
    };

export type WallpaperAutomationStatus =
  | { kind: 'available'; label: string }
  | { kind: 'unavailable'; label: string; message: string };

export interface WallpaperAutomationAvailability {
  capabilities: WallpaperCapabilities;
  status: WallpaperAutomationStatus;
}

export const wallpaperAutomationFallback: WallpaperAutomationAvailability = {
  capabilities: {
    kind: 'unavailable',
    supportedTargets: { home: false, lock: false, both: false },
  },
  status: {
    kind: 'unavailable',
    label: 'Status: unavailable',
    message:
      'Scheduling remains unavailable until the Android wallpaper service arrives.',
  },
};

/**
 * Target support is native as of Task 6. Rotation remains deliberately
 * unavailable until Task 7 provides its native implementation.
 */
export async function getWallpaperAutomationAvailability(): Promise<WallpaperAutomationAvailability> {
  const capabilities = await getWallpaperCapabilities();
  return {
    capabilities: {
      kind: 'available',
      supportedTargets: {
        home: capabilities.supportsHome,
        lock: capabilities.supportsLock,
        both: capabilities.supportsHome && capabilities.supportsLock,
      },
    },
    status: wallpaperAutomationFallback.status,
  };
}

export function isWallpaperTargetAvailable(
  target: WallpaperTarget,
  capabilities: WallpaperCapabilities,
): boolean {
  return capabilities.supportedTargets[target];
}
