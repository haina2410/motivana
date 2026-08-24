import { getRotationStatusRecovery } from '../rotationStatus';

test.each([
  ['EMPTY_FAVORITES', 'Rotation needs at least one saved favorite.', 'correct'],
  [
    'LOCK_UNSUPPORTED',
    'This device cannot apply rotation to that screen.',
    'correct',
  ],
  [
    'SYSTEM_FAILED',
    'Android could not finish the scheduled rotation. Try again.',
    'retry',
  ],
  [
    'APPLY_FAILED',
    'Android could not apply the scheduled wallpaper. Try again.',
    'retry',
  ],
] as const)(
  'maps the allow-listed %s status code to safe recovery text',
  (code, message, action) => {
    expect(getRotationStatusRecovery(code)).toEqual({ message, action });
  },
);

test('does not expose an unknown scheduled-worker status code', () => {
  expect(getRotationStatusRecovery('native exception: secret')).toEqual({
    message:
      'Rotation did not complete. Review the rotation preferences and try again.',
    action: 'correct',
  });
});
