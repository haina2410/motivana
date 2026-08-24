import type { PersistedAppStateV2 } from './schema';

export type RotationSynchronizer = (
  state: PersistedAppStateV2,
) => Promise<void>;

let synchronizer: RotationSynchronizer | undefined;

/** The app root supplies the native bridge; the store never imports a device module. */
export function setRotationSynchronizer(value: RotationSynchronizer): void {
  synchronizer = value;
}

export async function synchronizeRotationState(
  state: PersistedAppStateV2,
): Promise<void> {
  if (synchronizer === undefined) {
    throw new Error('Rotation synchronization is unavailable.');
  }
  await synchronizer(state);
}
