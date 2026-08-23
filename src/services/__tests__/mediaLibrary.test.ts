import {
  createMediaLibrarySaver,
  isAppOwnedWallpaperUri,
  WallpaperServiceError,
} from '../mediaLibrary';

const appCacheUri = 'file:///data/user/0/org.haina2410.motivana/cache';

function createDependencies(permission: {
  granted: boolean;
  canAskAgain: boolean;
}) {
  return {
    appCacheUri,
    requestPermissionsAsync: jest.fn(async () => permission),
    createAsset: jest.fn(async () => ({ id: 'media-asset-42' })),
  };
}

test('recognizes only an exported app-cache file as saveable', () => {
  expect(
    isAppOwnedWallpaperUri(
      `${appCacheUri}/motivana-exports/forest.png`,
      appCacheUri,
    ),
  ).toBe(true);
  expect(isAppOwnedWallpaperUri('content://media/image/42', appCacheUri)).toBe(
    false,
  );
  expect(
    isAppOwnedWallpaperUri('https://example.test/wall.png', appCacheUri),
  ).toBe(false);
  expect(isAppOwnedWallpaperUri(`${appCacheUri}/other.png`, appCacheUri)).toBe(
    false,
  );
});

test('requests write-only photo permission and creates a modern media asset', async () => {
  const dependencies = createDependencies({ granted: true, canAskAgain: true });
  const saveWallpaper = createMediaLibrarySaver(dependencies);
  const uri = `${appCacheUri}/motivana-exports/forest.png`;

  await expect(saveWallpaper(uri)).resolves.toEqual({
    assetId: 'media-asset-42',
  });
  expect(dependencies.requestPermissionsAsync).toHaveBeenCalledWith({
    writeOnly: true,
    granularPermissions: ['photo'],
  });
  expect(dependencies.createAsset).toHaveBeenCalledWith(uri);
});

test.each([
  [{ granted: false, canAskAgain: true }, true],
  [{ granted: false, canAskAgain: false }, false],
])(
  'reports denied save permission with canAskAgain=%s',
  async (permission, expected) => {
    const saveWallpaper = createMediaLibrarySaver(
      createDependencies(permission),
    );

    await expect(
      saveWallpaper(`${appCacheUri}/motivana-exports/forest.png`),
    ).rejects.toMatchObject<Partial<WallpaperServiceError>>({
      code: 'PERMISSION_DENIED',
      canAskAgain: expected,
    });
  },
);

test('rejects a non-app-owned URI before prompting for media permission', async () => {
  const dependencies = createDependencies({ granted: true, canAskAgain: true });
  const saveWallpaper = createMediaLibrarySaver(dependencies);

  await expect(saveWallpaper('content://media/image/42')).rejects.toMatchObject(
    {
      code: 'FILE_NOT_FOUND',
    },
  );
  expect(dependencies.requestPermissionsAsync).not.toHaveBeenCalled();
});

test('maps a rejected permission request to a safe save failure', async () => {
  const dependencies = createDependencies({ granted: true, canAskAgain: true });
  dependencies.requestPermissionsAsync.mockRejectedValueOnce(
    new Error('secret'),
  );
  await expect(
    createMediaLibrarySaver(dependencies)(
      `${appCacheUri}/motivana-exports/forest.png`,
    ),
  ).rejects.toMatchObject({ code: 'SAVE_FAILED' });
});
