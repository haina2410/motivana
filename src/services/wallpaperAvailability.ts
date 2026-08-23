import type { WallpaperTarget } from '../store/schema';

export type WallpaperCapabilities =
  | {
      kind: 'available';
      supportedTargets: Readonly<Record<WallpaperTarget, boolean>>;
    }
  | {
      kind: 'unavailable';
      label: string;
      message: string;
      supportedTargets: Readonly<Record<WallpaperTarget, boolean>>;
    };

export type WallpaperAutomationStatus =
  | { kind: 'available'; label: string }
  | { kind: 'unavailable'; label: string; message: string };

export interface WallpaperAutomationAvailability {
  capabilities: WallpaperCapabilities;
  status: WallpaperAutomationStatus;
}

const taskFiveAvailability: WallpaperAutomationAvailability = {
  capabilities: {
    kind: 'unavailable',
    label: 'Wallpaper service unavailable',
    message:
      'Scheduling will activate only after the Android wallpaper service is installed.',
    supportedTargets: { home: true, lock: false, both: false },
  },
  status: {
    kind: 'unavailable',
    label: 'Status: unavailable',
    message:
      'Scheduling remains unavailable until the Android wallpaper service arrives.',
  },
};

/**
 * Task 5 is intentionally a read-only boundary. Task 6 can replace this
 * adapter with the Android service without changing UI capability handling.
 */
export function getWallpaperAutomationAvailability(): WallpaperAutomationAvailability {
  return taskFiveAvailability;
}

export function isWallpaperTargetAvailable(
  target: WallpaperTarget,
  capabilities: WallpaperCapabilities,
): boolean {
  return capabilities.supportedTargets[target];
}
