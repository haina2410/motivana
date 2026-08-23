import {
  getWallpaperCapabilities,
  normalizeWallpaperServiceError,
  setWallpaper,
  validateWallpaperTarget,
} from '../wallpaperNative';

jest.mock('../../../modules/motivana-wallpaper', () => ({
  getCapabilities: jest.fn(async () => ({
    supportsHome: true,
    supportsLock: false,
  })),
  setWallpaper: jest.fn(async () => undefined),
  configureRotation: jest.fn(async () => {
    throw { code: 'NOT_IMPLEMENTED' };
  }),
  getRotationStatus: jest.fn(async () => {
    throw { code: 'NOT_IMPLEMENTED' };
  }),
  runRotationNow: jest.fn(async () => {
    throw { code: 'NOT_IMPLEMENTED' };
  }),
}));

const nativeModule = jest.requireMock(
  '../../../modules/motivana-wallpaper',
) as {
  getCapabilities: jest.Mock;
  setWallpaper: jest.Mock;
};

beforeEach(() => jest.clearAllMocks());

test.each(['home', 'lock', 'both'])(
  'accepts %s as a native wallpaper target',
  (target) => {
    expect(validateWallpaperTarget(target)).toBe(target);
  },
);

test('rejects an unknown native wallpaper target', () => {
  expect(() => validateWallpaperTarget('desk')).toThrow(
    expect.objectContaining({ code: 'INVALID_TARGET' }),
  );
});

test('reads the typed capabilities from the native bridge', async () => {
  await expect(getWallpaperCapabilities()).resolves.toEqual({
    supportsHome: true,
    supportsLock: false,
  });
});

test('passes a validated cache URI and target to the native bridge', async () => {
  await expect(
    setWallpaper(
      'file:///data/user/0/org.haina2410.motivana/cache/motivana-exports/forest.png',
      'home',
    ),
  ).resolves.toBeUndefined();
  expect(nativeModule.setWallpaper).toHaveBeenCalledWith(
    'file:///data/user/0/org.haina2410.motivana/cache/motivana-exports/forest.png',
    'home',
  );
});

test.each([
  'INVALID_TARGET',
  'WALLPAPER_NOT_ALLOWED',
  'LOCK_UNSUPPORTED',
  'FILE_NOT_FOUND',
  'DECODE_FAILED',
  'APPLY_FAILED',
])('preserves the stable native %s error code', (code) => {
  expect(normalizeWallpaperServiceError({ code })).toMatchObject({ code });
});

test('does not expose arbitrary native exception text', () => {
  expect(
    normalizeWallpaperServiceError(new Error('secret native exception')),
  ).toMatchObject({
    code: 'APPLY_FAILED',
    message: 'Could not apply the wallpaper.',
  });
});
