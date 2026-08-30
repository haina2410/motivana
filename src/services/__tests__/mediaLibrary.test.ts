import {
  canSaveToPhotoLibrary,
  createMediaLibrarySaver,
  isAppOwnedWallpaperUri,
  WallpaperServiceError,
} from '../mediaLibrary';

const appCacheUri = 'file:///data/user/0/org.haina2410.motivana/cache';
const exportedUri = `${appCacheUri}/motivana-exports/forest.png`;

function createDependencies(
  apiLevel: number,
  permission: { granted: boolean; canAskAgain: boolean } = {
    granted: true,
    canAskAgain: true,
  },
) {
  return {
    appCacheUri,
    apiLevel,
    requestWritePermission: jest.fn(async () => permission),
    createAsset: jest.fn(async () => ({ id: 'media-asset-42' })),
  };
}

test('recognizes only an exported app-cache file as saveable', () => {
  expect(isAppOwnedWallpaperUri(exportedUri, appCacheUri)).toBe(true);
  expect(
    isAppOwnedWallpaperUri(`${appCacheUri}/motivana-exports/`, appCacheUri),
  ).toBe(false);
  expect(isAppOwnedWallpaperUri('content://media/image/42', appCacheUri)).toBe(
    false,
  );
  expect(
    isAppOwnedWallpaperUri(
      'file:///storage/emulated/0/Pictures/forest.png',
      appCacheUri,
    ),
  ).toBe(false);
});

// Android 10 enforces scoped storage by target SDK, and this app targets 36, so
// the pre-30 save path cannot write however the permission is answered.
test('reports Android 10 as the one level that cannot save', () => {
  expect(canSaveToPhotoLibrary(28)).toBe(true);
  expect(canSaveToPhotoLibrary(29)).toBe(false);
  expect(canSaveToPhotoLibrary(30)).toBe(true);
  expect(canSaveToPhotoLibrary(36)).toBe(true);
});

// From API 30 the library inserts through MediaStore, which needs no permission.
test('creates a modern media asset without requesting a permission', async () => {
  const dependencies = createDependencies(33);
  const saveWallpaper = createMediaLibrarySaver(dependencies);

  await expect(saveWallpaper(exportedUri)).resolves.toEqual({
    assetId: 'media-asset-42',
  });
  expect(dependencies.requestWritePermission).not.toHaveBeenCalled();
  expect(dependencies.createAsset).toHaveBeenCalledWith(exportedUri);
});

// Below API 30 the legacy factory throws without WRITE_EXTERNAL_STORAGE. The
// request is write-only: no READ_MEDIA_IMAGES is ever asked for or declared.
test('requests the write permission before a legacy save', async () => {
  const dependencies = createDependencies(28);
  const saveWallpaper = createMediaLibrarySaver(dependencies);

  await expect(saveWallpaper(exportedUri)).resolves.toEqual({
    assetId: 'media-asset-42',
  });
  expect(dependencies.requestWritePermission).toHaveBeenCalled();
  expect(dependencies.createAsset).toHaveBeenCalledWith(exportedUri);
});

test.each([
  [{ granted: false, canAskAgain: true }, true],
  [{ granted: false, canAskAgain: false }, false],
])(
  'reports denied write permission with canAskAgain=%s',
  async (permission, expected) => {
    const dependencies = createDependencies(28, permission);
    const saveWallpaper = createMediaLibrarySaver(dependencies);

    await expect(saveWallpaper(exportedUri)).rejects.toMatchObject<
      Partial<WallpaperServiceError>
    >({
      code: 'PERMISSION_DENIED',
      canAskAgain: expected,
    });
    expect(dependencies.createAsset).not.toHaveBeenCalled();
  },
);

test('refuses the save on Android 10 without prompting for anything', async () => {
  const dependencies = createDependencies(29);
  const saveWallpaper = createMediaLibrarySaver(dependencies);

  await expect(saveWallpaper(exportedUri)).rejects.toMatchObject({
    code: 'SAVE_FAILED',
  });
  expect(dependencies.requestWritePermission).not.toHaveBeenCalled();
  expect(dependencies.createAsset).not.toHaveBeenCalled();
});

test('rejects a non-app-owned URI before touching the media library', async () => {
  const dependencies = createDependencies(33);
  const saveWallpaper = createMediaLibrarySaver(dependencies);

  await expect(saveWallpaper('content://media/image/42')).rejects.toMatchObject(
    {
      code: 'FILE_NOT_FOUND',
    },
  );
  expect(dependencies.requestWritePermission).not.toHaveBeenCalled();
  expect(dependencies.createAsset).not.toHaveBeenCalled();
});

test('maps a rejected permission request to a safe save failure', async () => {
  const dependencies = createDependencies(28);
  dependencies.requestWritePermission.mockRejectedValueOnce(
    new Error('secret'),
  );

  await expect(
    createMediaLibrarySaver(dependencies)(exportedUri),
  ).rejects.toMatchObject({ code: 'SAVE_FAILED' });
});

test('maps a rejected asset write to a safe save failure', async () => {
  const dependencies = createDependencies(33);
  dependencies.createAsset.mockRejectedValueOnce(new Error('secret'));

  await expect(
    createMediaLibrarySaver(dependencies)(exportedUri),
  ).rejects.toMatchObject({ code: 'SAVE_FAILED' });
});
