export type RotationStatusRecoveryAction = 'retry' | 'correct';

export interface RotationStatusRecovery {
  message: string;
  action: RotationStatusRecoveryAction;
}

const statusRecoveryByCode: Readonly<Record<string, RotationStatusRecovery>> = {
  EMPTY_FAVORITES: {
    message: 'Rotation needs at least one saved favorite.',
    action: 'correct',
  },
  NO_ELIGIBLE_QUOTES: {
    message:
      'Rotation has no eligible quotes. Use all quotes or save a favorite.',
    action: 'correct',
  },
  INVALID_CONFIGURATION: {
    message: 'Rotation preferences need to be saved again.',
    action: 'correct',
  },
  LOCK_UNSUPPORTED: {
    message: 'This device cannot apply rotation to that screen.',
    action: 'correct',
  },
  ASSET_INVALID: {
    message:
      'Rotation resources need attention. Review the rotation preferences.',
    action: 'correct',
  },
  FONT_MISSING: {
    message:
      'A required rotation font is unavailable. Review the rotation preferences.',
    action: 'correct',
  },
  ASSET_IO: {
    message: 'Rotation resources are temporarily unavailable. Try again.',
    action: 'retry',
  },
  SYSTEM_FAILED: {
    message: 'Android could not finish the scheduled rotation. Try again.',
    action: 'retry',
  },
  RENDER_FAILED: {
    message: 'Android could not render the scheduled wallpaper. Try again.',
    action: 'retry',
  },
  APPLY_FAILED: {
    message: 'Android could not apply the scheduled wallpaper. Try again.',
    action: 'retry',
  },
};

const unknownStatusRecovery: RotationStatusRecovery = {
  message:
    'Rotation did not complete. Review the rotation preferences and try again.',
  action: 'correct',
};

export function getRotationStatusRecovery(
  code: string | undefined,
): RotationStatusRecovery | undefined {
  if (code === undefined) return undefined;
  return statusRecoveryByCode[code] ?? unknownStatusRecovery;
}
