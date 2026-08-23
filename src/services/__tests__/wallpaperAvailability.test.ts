import {
  getWallpaperAutomationAvailability,
  isWallpaperTargetAvailable,
} from '../wallpaperAvailability';

jest.mock('../wallpaperNative', () => ({
  getWallpaperCapabilities: jest.fn(async () => ({
    supportsHome: true,
    supportsLock: false,
  })),
  getRotationStatus: jest.fn(async () => ({
    enabled: false,
    state: 'disabled',
  })),
}));

test('reports native target capability and live rotation status', async () => {
  const availability = await getWallpaperAutomationAvailability();

  expect(availability.capabilities.kind).toBe('available');
  expect(availability.status).toMatchObject({
    kind: 'available',
    state: 'disabled',
  });
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
