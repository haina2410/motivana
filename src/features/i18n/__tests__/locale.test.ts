import {
  contentLocales,
  isContentLocale,
  isLocale,
  locales,
  resolveDeviceLocale,
} from '../locale';

// Mutation caught: accepting an unknown tag would let an unsupported locale reach the string catalog and render undefined text.
test('accepts only the supported locales', () => {
  expect(locales).toEqual(['en', 'vi']);
  expect(isLocale('en')).toBe(true);
  expect(isLocale('vi')).toBe(true);
  expect(isLocale('fr')).toBe(false);
  expect(isLocale(undefined)).toBe(false);
});

// Mutation caught: comparing the whole tag instead of the language subtag would send a vi-VN device to English.
test('resolves the device language from the first supported tag', () => {
  expect(resolveDeviceLocale(['vi-VN', 'en-US'])).toBe('vi');
  expect(resolveDeviceLocale(['en-GB'])).toBe('en');
  expect(resolveDeviceLocale(['VI'])).toBe('vi');
});

// Mutation caught: returning undefined for an unsupported device language would leave the app with no locale at first launch.
test('falls back to English when no tag is supported', () => {
  expect(resolveDeviceLocale(['fr-FR', 'de-DE'])).toBe('en');
  expect(resolveDeviceLocale([])).toBe('en');
});

// Mutation caught: letting isLocale answer for the setting would either reject "all" or let "all" become a catalogue text key.
test('accepts every content language choice, and keeps "all" out of the catalogue locales', () => {
  expect(contentLocales).toEqual(['en', 'vi', 'all']);
  expect(isContentLocale('all')).toBe(true);
  expect(isContentLocale('en')).toBe(true);
  expect(isContentLocale('fr')).toBe(false);
  expect(isLocale('all')).toBe(false);
});
