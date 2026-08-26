import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { SetWallpaperSheet } from '../SetWallpaperSheet';
import { getAllQuotes } from '../../features/quotes/quoteRepository';
import type { WallpaperComposition } from '../../features/wallpaper/composition';
import { createDefaultPersistedAppState } from '../../store/schema';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../features/i18n/t';

jest.mock('../../features/wallpaper/exportWallpaper', () => ({
  exportWallpaper: jest.fn(),
}));
jest.mock('../../services/mediaLibrary', () => ({
  saveWallpaper: jest.fn(),
  WallpaperServiceError: class WallpaperServiceError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));
jest.mock('../../services/wallpaperNative', () => ({
  getWallpaperCapabilities: jest.fn(),
  setWallpaper: jest.fn(),
}));

const mockExportWallpaper = jest.requireMock(
  '../../features/wallpaper/exportWallpaper',
).exportWallpaper as jest.Mock;
const mockSaveWallpaper = jest.requireMock('../../services/mediaLibrary')
  .saveWallpaper as jest.Mock;
const nativeService = jest.requireMock('../../services/wallpaperNative') as {
  getWallpaperCapabilities: jest.Mock;
  setWallpaper: jest.Mock;
};

const exportUri =
  'file:///data/user/0/org.haina2410.motivana/cache/motivana-exports/forest.png';

function compositionFor(quoteId: string): WallpaperComposition {
  return {
    cacheKey: `forest-discipline-${quoteId}-1080x2400`,
    width: 1080,
    height: 2400,
    quote: {
      id: quoteId,
      category: 'focus',
      sourceLocale: 'en',
      text: { en: 'Keep going.' },
    },
  } as WallpaperComposition;
}

const composition = compositionFor('composition-quote');
const fontProvider = {} as never;

function renderSheet(target = composition) {
  return render(
    <SetWallpaperSheet
      composition={target}
      fontProvider={fontProvider}
      onClose={() => undefined}
      visible
    />,
  );
}

const applyButton = () =>
  screen.getByRole('button', { name: t('en', 'sheet.apply') });

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState({
    ...createDefaultPersistedAppState(),
    lastAppliedQuoteId: undefined,
  });
  nativeService.getWallpaperCapabilities.mockResolvedValue({
    supportsHome: true,
    supportsLock: false,
  });
  mockExportWallpaper.mockResolvedValue({
    uri: exportUri,
    width: 1080,
    height: 2400,
  });
  mockSaveWallpaper.mockResolvedValue({ assetId: '42' });
  nativeService.setWallpaper.mockResolvedValue(undefined);
});

// Mutation caught: recording before setWallpaper resolves would mark a wallpaper as applied after a failed native request.
test('records the quote only after applying succeeds', async () => {
  const quoteId = getAllQuotes()[2]!.id;
  renderSheet(compositionFor(quoteId));
  await waitFor(() => expect(applyButton()).toBeEnabled());

  fireEvent.press(applyButton());

  await waitFor(() =>
    expect(screen.getByText(t('en', 'actions.success.home'))).toBeOnTheScreen(),
  );
  expect(nativeService.setWallpaper).toHaveBeenCalledWith(exportUri, 'home');
  expect(useAppStore.getState().lastAppliedQuoteId).toBe(quoteId);
});

// Mutation caught: an unsupported target left selectable would send the device a request it rejects.
test('keeps a target the device cannot serve unselectable', async () => {
  renderSheet();
  await waitFor(() => expect(applyButton()).toBeEnabled());

  expect(screen.getByLabelText(t('en', 'sheet.target.lock'))).toBeDisabled();
  expect(screen.getByLabelText(t('en', 'sheet.target.both'))).toBeDisabled();
  expect(screen.getByLabelText(t('en', 'sheet.target.home'))).toBeEnabled();
});

// Mutation caught: a persisted lock target on a home-only device would apply nothing.
test('falls back to Home when the persisted target is unsupported', async () => {
  useAppStore.setState({ wallpaperTarget: 'lock' });
  renderSheet();
  await waitFor(() => expect(applyButton()).toBeEnabled());

  fireEvent.press(applyButton());

  await waitFor(() =>
    expect(nativeService.setWallpaper).toHaveBeenCalledWith(exportUri, 'home'),
  );
});

// Mutation caught: clearing the active export after a native failure would make Retry render a second image.
test('reuses the rendered export on retry and records only then', async () => {
  const quoteId = getAllQuotes()[3]!.id;
  nativeService.setWallpaper.mockRejectedValueOnce({ code: 'APPLY_FAILED' });
  renderSheet(compositionFor(quoteId));
  await waitFor(() => expect(applyButton()).toBeEnabled());

  fireEvent.press(applyButton());
  await waitFor(() =>
    expect(
      screen.getByText(t('en', 'actions.error.default')),
    ).toBeOnTheScreen(),
  );
  expect(useAppStore.getState().lastAppliedQuoteId).toBeUndefined();

  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'actions.retry.label') }),
  );
  await waitFor(() =>
    expect(nativeService.setWallpaper).toHaveBeenCalledTimes(2),
  );
  expect(mockExportWallpaper).toHaveBeenCalledTimes(1);
  expect(useAppStore.getState().lastAppliedQuoteId).toBe(quoteId);
});

// Mutation caught: a missing cache file reused on retry would fail forever.
test('renders again when the retry file is gone', async () => {
  nativeService.setWallpaper.mockRejectedValueOnce({ code: 'FILE_NOT_FOUND' });
  renderSheet();
  await waitFor(() => expect(applyButton()).toBeEnabled());

  fireEvent.press(applyButton());
  await waitFor(() =>
    expect(
      screen.getByText(t('en', 'actions.error.fileNotFound')),
    ).toBeOnTheScreen(),
  );
  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'actions.retry.label') }),
  );

  await waitFor(() => expect(mockExportWallpaper).toHaveBeenCalledTimes(2));
});

test('applies one rendered export when Apply is pressed repeatedly', async () => {
  let resolveExport: (value: {
    uri: string;
    width: number;
    height: number;
  }) => void;
  mockExportWallpaper.mockReturnValue(
    new Promise((resolve) => {
      resolveExport = resolve;
    }),
  );
  renderSheet();
  await waitFor(() => expect(applyButton()).toBeEnabled());

  fireEvent.press(applyButton());
  fireEvent.press(applyButton());
  expect(mockExportWallpaper).toHaveBeenCalledTimes(1);

  await act(async () =>
    resolveExport!({ uri: exportUri, width: 1080, height: 2400 }),
  );
  await waitFor(() =>
    expect(nativeService.setWallpaper).toHaveBeenCalledTimes(1),
  );
});

test('reports the renderer failure code without applying anything', async () => {
  mockExportWallpaper.mockRejectedValueOnce({ code: 'FILE_WRITE_FAILED' });
  renderSheet();
  await waitFor(() => expect(applyButton()).toBeEnabled());

  fireEvent.press(applyButton());

  await waitFor(() =>
    expect(
      screen.getByText(
        t('en', 'actions.export.failed', { code: 'FILE_WRITE_FAILED' }),
      ),
    ).toBeOnTheScreen(),
  );
  expect(nativeService.setWallpaper).not.toHaveBeenCalled();
});

// Mutation caught: saving the photo copy inside the apply attempt would report an
// applied wallpaper as failed when only the optional copy could not be written.
test('keeps the applied wallpaper reported when the photo copy fails', async () => {
  useAppStore.setState({ saveToPhotoLibrary: true });
  mockSaveWallpaper.mockRejectedValueOnce({ code: 'SAVE_FAILED' });
  renderSheet();
  await waitFor(() => expect(applyButton()).toBeEnabled());

  fireEvent.press(applyButton());

  await waitFor(() =>
    expect(
      screen.getByText(t('en', 'actions.error.saveFailed')),
    ).toBeOnTheScreen(),
  );
  expect(screen.getByText(t('en', 'actions.success.home'))).toBeOnTheScreen();
});

test.each([
  [false, 0],
  [true, 1],
])(
  'writes the photo copy only when the setting asks for it (%s)',
  async (saveToPhotoLibrary, expectedSaves) => {
    useAppStore.setState({ saveToPhotoLibrary });
    renderSheet();
    await waitFor(() => expect(applyButton()).toBeEnabled());

    fireEvent.press(applyButton());

    await waitFor(() =>
      expect(nativeService.setWallpaper).toHaveBeenCalledTimes(1),
    );
    expect(mockSaveWallpaper).toHaveBeenCalledTimes(expectedSaves);
  },
);
