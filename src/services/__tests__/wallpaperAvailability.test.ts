import {
  getWallpaperAutomationAvailability,
  isWallpaperTargetAvailable,
} from '../wallpaperAvailability';

jest.mock('../wallpaperNative', () => ({
  getWallpaperCapabilities: jest.fn(async () => ({
    supportsHome: true,
    supportsLock: false,
  })),
}));

test('reports native target capability while retaining truthful Task 7-unavailable rotation status', async () => {
  const availability = await getWallpaperAutomationAvailability();

  expect(availability.capabilities.kind).toBe('available');
  expect(availability.status.kind).toBe('unavailable');
});

test.each([
  ['home', true],
  ['lock', false],
  ['both', false],
] as const)(
  '%s target availability is derived from capabilities',
  async (target, expected) => {
    expect(
      isWallpaperTargetAvailable(
        target,
        (await getWallpaperAutomationAvailability()).capabilities,
      ),
    ).toBe(expected);
  },
);
