import type { StringKey } from '../features/i18n/t';

export type RotationStatusRecoveryAction = 'retry' | 'correct';

export interface RotationStatusRecovery {
  messageKey: StringKey;
  action: RotationStatusRecoveryAction;
}

export interface RotationStatusRecoveryControl {
  labelKey: StringKey;
  hintKey: StringKey;
  operation: 'run-now' | 'reschedule';
}

/**
 * Holds catalog keys, not text, so the screen translates with the reader's
 * app language and no caller can decide anything from the wording.
 */
const statusRecoveryByCode: Readonly<Record<string, RotationStatusRecovery>> = {
  EMPTY_FAVORITES: {
    messageKey: 'automation.recovery.emptyFavorites',
    action: 'correct',
  },
  NO_ELIGIBLE_QUOTES: {
    messageKey: 'automation.recovery.noEligibleQuotes',
    action: 'correct',
  },
  INVALID_CONFIGURATION: {
    messageKey: 'automation.recovery.invalidConfiguration',
    action: 'correct',
  },
  LOCK_UNSUPPORTED: {
    messageKey: 'automation.recovery.lockUnsupported',
    action: 'correct',
  },
  ASSET_INVALID: {
    messageKey: 'automation.recovery.assetInvalid',
    action: 'correct',
  },
  FONT_MISSING: {
    messageKey: 'automation.recovery.fontMissing',
    action: 'correct',
  },
  ASSET_IO: {
    messageKey: 'automation.recovery.assetIo',
    action: 'retry',
  },
  SYSTEM_FAILED: {
    messageKey: 'automation.recovery.systemFailed',
    action: 'retry',
  },
  RENDER_FAILED: {
    messageKey: 'automation.recovery.renderFailed',
    action: 'retry',
  },
  APPLY_FAILED: {
    messageKey: 'automation.recovery.applyFailed',
    action: 'retry',
  },
};

const unknownStatusRecovery: RotationStatusRecovery = {
  messageKey: 'automation.recovery.unknown',
  action: 'correct',
};

export function getRotationStatusRecovery(
  code: string | undefined,
): RotationStatusRecovery | undefined {
  if (code === undefined) return undefined;
  return statusRecoveryByCode[code] ?? unknownStatusRecovery;
}

/**
 * The control the screen offers beside a failure message, or none.
 *
 * A `correct` action has no control: the screen saves every change as the
 * reader makes it, so there are no held preferences left to commit, and the
 * codes that carry that action are faults no preference can repair. Offering a
 * button there re-ran the same save and repeated the same failure.
 */
export function getRotationStatusRecoveryControl(
  recovery: RotationStatusRecovery,
  isDebug: boolean,
): RotationStatusRecoveryControl | undefined {
  if (recovery.action === 'correct') return undefined;
  if (isDebug) {
    return {
      labelKey: 'automation.recovery.retryNow.label',
      hintKey: 'automation.recovery.retryNow.hint',
      operation: 'run-now',
    };
  }
  return {
    labelKey: 'automation.recovery.reschedule.label',
    hintKey: 'automation.recovery.reschedule.hint',
    operation: 'reschedule',
  };
}
