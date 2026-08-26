import {
  createMediaLibrarySaver,
  isAppOwnedWallpaperUri,
} from '../mediaLibrary';

const appCacheUri = 'file:///data/user/0/org.haina2410.motivana/cache';

function createDependencies() {
  return {
    appCacheUri,
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

// The write asks for no permission: from Android 11 the media library inserts
// the asset through MediaStore, and the app declares no media permission.
test('creates a modern media asset without requesting a permission', async () => {
  const dependencies = createDependencies();
  const saveWallpaper = createMediaLibrarySaver(dependencies);
  const uri = `${appCacheUri}/motivana-exports/forest.png`;

  await expect(saveWallpaper(uri)).resolves.toEqual({
    assetId: 'media-asset-42',
  });
  expect(dependencies.createAsset).toHaveBeenCalledWith(uri);
});

test('rejects a non-app-owned URI before touching the media library', async () => {
  const dependencies = createDependencies();
  const saveWallpaper = createMediaLibrarySaver(dependencies);

  await expect(saveWallpaper('content://media/image/42')).rejects.toMatchObject(
    {
      code: 'FILE_NOT_FOUND',
    },
  );
  expect(dependencies.createAsset).not.toHaveBeenCalled();
});

test('maps a rejected asset write to a safe save failure', async () => {
  const dependencies = createDependencies();
  dependencies.createAsset.mockRejectedValueOnce(new Error('secret'));
  await expect(
    createMediaLibrarySaver(dependencies)(
      `${appCacheUri}/motivana-exports/forest.png`,
    ),
  ).rejects.toMatchObject({ code: 'SAVE_FAILED' });
});
