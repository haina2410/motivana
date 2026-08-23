import {
  getWallpaperAutomationAvailability,
  isWallpaperTargetAvailable,
} from '../wallpaperAvailability';

test('the Task 5 adapter explicitly reports unavailable native automation', () => {
  const availability = getWallpaperAutomationAvailability();

  expect(availability.capabilities.kind).toBe('unavailable');
  expect(availability.status.kind).toBe('unavailable');
});

test.each([
  ['home', true],
  ['lock', false],
  ['both', false],
] as const)(
  '%s target availability is derived from capabilities',
  (target, expected) => {
    expect(
      isWallpaperTargetAvailable(
        target,
        getWallpaperAutomationAvailability().capabilities,
      ),
    ).toBe(expected);
  },
);
