import { locales } from '../../features/i18n/locale';
import { t } from '../../features/i18n/t';
import {
  getRotationStatusRecovery,
  getRotationStatusRecoveryControl,
} from '../rotationStatus';

test.each([
  ['EMPTY_FAVORITES', 'automation.recovery.emptyFavorites', 'correct'],
  ['LOCK_UNSUPPORTED', 'automation.recovery.lockUnsupported', 'correct'],
  ['SYSTEM_FAILED', 'automation.recovery.systemFailed', 'retry'],
  ['APPLY_FAILED', 'automation.recovery.applyFailed', 'retry'],
] as const)(
  'maps the allow-listed %s status code to a safe recovery key',
  (code, messageKey, action) => {
    expect(getRotationStatusRecovery(code)).toEqual({ messageKey, action });
  },
);

test('does not expose an unknown scheduled-worker status code', () => {
  expect(getRotationStatusRecovery('native exception: secret')).toEqual({
    messageKey: 'automation.recovery.unknown',
    action: 'correct',
  });
});

test('labels a release worker recovery as rescheduling rather than an immediate retry', () => {
  const recovery = getRotationStatusRecovery('SYSTEM_FAILED')!;

  expect(getRotationStatusRecoveryControl(recovery, false)).toEqual({
    labelKey: 'automation.recovery.reschedule.label',
    hintKey: 'automation.recovery.reschedule.hint',
    operation: 'reschedule',
  });
});

test('labels a debug worker recovery as an immediate retry', () => {
  const recovery = getRotationStatusRecovery('SYSTEM_FAILED')!;

  expect(getRotationStatusRecoveryControl(recovery, true)).toEqual({
    labelKey: 'automation.recovery.retryNow.label',
    hintKey: 'automation.recovery.retryNow.hint',
    operation: 'run-now',
  });
});

const codes = [
  'EMPTY_FAVORITES',
  'NO_ELIGIBLE_QUOTES',
  'INVALID_CONFIGURATION',
  'LOCK_UNSUPPORTED',
  'ASSET_INVALID',
  'FONT_MISSING',
  'ASSET_IO',
  'SYSTEM_FAILED',
  'RENDER_FAILED',
  'APPLY_FAILED',
  'native exception: secret',
] as const;

test.each(locales)(
  'every recovery message and control reads as text in %s',
  (locale) => {
    for (const code of codes) {
      const recovery = getRotationStatusRecovery(code)!;
      expect(t(locale, recovery.messageKey)).not.toHaveLength(0);
      for (const isDebug of [false, true]) {
        const control = getRotationStatusRecoveryControl(recovery, isDebug);
        expect(t(locale, control.labelKey)).not.toHaveLength(0);
        expect(t(locale, control.hintKey)).not.toHaveLength(0);
      }
    }
  },
);
