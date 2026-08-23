import {
  configureRotation,
  getRotationStatus,
  runRotationNow,
} from '../wallpaperNative';

jest.mock('../../../modules/motivana-wallpaper', () => ({
  getCapabilities: jest.fn(),
  setWallpaper: jest.fn(),
  configureRotation: jest.fn(),
  getRotationStatus: jest.fn(),
  runRotationNow: jest.fn(),
}));

const native = jest.requireMock('../../../modules/motivana-wallpaper') as {
  configureRotation: jest.Mock;
  getRotationStatus: jest.Mock;
  runRotationNow: jest.Mock;
};

beforeEach(() => jest.clearAllMocks());

test('configures native rotation before a caller can persist UI state', async () => {
  const order: string[] = [];
  native.configureRotation.mockImplementation(async () => order.push('native'));
  await configureRotation({
    enabled: true,
    intervalHours: 6,
    target: 'home',
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuoteIds: [],
    favoriteQuotesOnly: false,
  });
  order.push('zustand');
  expect(order).toEqual(['native', 'zustand']);
});

test('keeps stable rotation status fields and debug-only failure codes', async () => {
  native.getRotationStatus.mockResolvedValue({
    enabled: true,
    state: 'succeeded',
    lastAppliedAt: 10,
    lastQuoteId: 'motivation-001',
  });
  await expect(getRotationStatus()).resolves.toMatchObject({
    state: 'succeeded',
    lastQuoteId: 'motivation-001',
  });
  native.runRotationNow.mockRejectedValue({ code: 'DEBUG_ONLY' });
  await expect(runRotationNow()).rejects.toMatchObject({ code: 'DEBUG_ONLY' });
});
