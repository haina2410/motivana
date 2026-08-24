import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { WallpaperActions } from '../WallpaperActions';
import { getAllQuotes } from '../../features/quotes/quoteRepository';
import type { WallpaperComposition } from '../../features/wallpaper/composition';
import { createDefaultPersistedAppState } from '../../store/schema';
import { useAppStore } from '../../store/useAppStore';

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

const composition = {
  cacheKey: 'forest-discipline-audre-lorde-1080x2400',
  width: 1080,
  height: 2400,
} as WallpaperComposition;
const fontProvider = {} as never;
const exportUri =
  'file:///data/user/0/org.haina2410.motivana/cache/motivana-exports/forest.png';

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
test('records the quote only after Set wallpaper succeeds', async () => {
  const quoteId = getAllQuotes()[2]!.id;
  const appliedComposition = {
    ...composition,
    quote: {
      id: quoteId,
      category: 'focus',
      sourceLocale: 'en',
      text: { en: 'Keep going.' },
      author: null,
    },
  } as never;
  render(
    <WallpaperActions
      composition={appliedComposition}
      fontProvider={fontProvider}
    />,
  );
  await waitFor(() =>
    expect(nativeService.getWallpaperCapabilities).toHaveBeenCalled(),
  );

  fireEvent.press(screen.getByRole('button', { name: 'Set wallpaper' }));
  fireEvent.press(screen.getByRole('button', { name: 'Set Home screen' }));

  await waitFor(() =>
    expect(
      screen.getByText('Wallpaper applied to your Home screen.'),
    ).toBeOnTheScreen(),
  );
  expect(useAppStore.getState().lastAppliedQuoteId).toBe(quoteId);
});

// Mutation caught: clearing the active quote after native failure would make Retry use a different composition.
test('keeps the active composition and does not record it when Set wallpaper fails', async () => {
  const quoteId = getAllQuotes()[3]!.id;
  const appliedComposition = {
    ...composition,
    quote: {
      id: quoteId,
      category: 'focus',
      sourceLocale: 'en',
      text: { en: 'Stay steady.' },
      author: null,
    },
  } as never;
  nativeService.setWallpaper.mockRejectedValueOnce({ code: 'APPLY_FAILED' });
  render(
    <WallpaperActions
      composition={appliedComposition}
      fontProvider={fontProvider}
    />,
  );
  await waitFor(() =>
    expect(nativeService.getWallpaperCapabilities).toHaveBeenCalled(),
  );

  fireEvent.press(screen.getByRole('button', { name: 'Set wallpaper' }));
  fireEvent.press(screen.getByRole('button', { name: 'Set Home screen' }));
  await waitFor(() =>
    expect(
      screen.getByText('Could not apply the wallpaper.'),
    ).toBeOnTheScreen(),
  );
  expect(useAppStore.getState().lastAppliedQuoteId).toBeUndefined();
  fireEvent.press(
    screen.getByRole('button', { name: 'Retry wallpaper action' }),
  );
  await waitFor(() =>
    expect(nativeService.setWallpaper).toHaveBeenCalledTimes(2),
  );
  expect(useAppStore.getState().lastAppliedQuoteId).toBe(quoteId);
});

test('saves one rendered export when Save is tapped repeatedly while it is working', async () => {
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
  render(
    <WallpaperActions composition={composition} fontProvider={fontProvider} />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Save wallpaper' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save wallpaper' }));
  expect(mockExportWallpaper).toHaveBeenCalledTimes(1);

  await act(async () =>
    resolveExport!({ uri: exportUri, width: 1080, height: 2400 }),
  );
  await waitFor(() =>
    expect(mockSaveWallpaper).toHaveBeenCalledWith(exportUri),
  );
  expect(mockSaveWallpaper).toHaveBeenCalledTimes(1);
});

test('offers only supported target choices before applying an exported wallpaper', async () => {
  render(
    <WallpaperActions composition={composition} fontProvider={fontProvider} />,
  );
  await waitFor(() =>
    expect(nativeService.getWallpaperCapabilities).toHaveBeenCalled(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Set wallpaper' }));

  expect(
    screen.getByRole('button', { name: 'Set Home screen' }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Set Lock screen' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Set both screens' })).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Set Home screen' }));
  await waitFor(() =>
    expect(nativeService.setWallpaper).toHaveBeenCalledWith(exportUri, 'home'),
  );
});

test('Retry keeps the failed action and uses the already-rendered export', async () => {
  mockSaveWallpaper
    .mockRejectedValueOnce({ code: 'SAVE_FAILED' })
    .mockResolvedValueOnce({ assetId: '42' });
  render(
    <WallpaperActions composition={composition} fontProvider={fontProvider} />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Save wallpaper' }));
  await waitFor(() =>
    expect(screen.getByText('Could not save the wallpaper.')).toBeOnTheScreen(),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Retry wallpaper action' }),
  );

  await waitFor(() =>
    expect(
      screen.getByText('Wallpaper saved to your photos.'),
    ).toBeOnTheScreen(),
  );
  expect(mockExportWallpaper).toHaveBeenCalledTimes(1);
  expect(mockSaveWallpaper).toHaveBeenCalledTimes(2);
});

test('shows a safe renderer failure code when foreground export fails', async () => {
  mockExportWallpaper.mockRejectedValueOnce({ code: 'FILE_WRITE_FAILED' });
  render(
    <WallpaperActions composition={composition} fontProvider={fontProvider} />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Save wallpaper' }));

  await waitFor(() =>
    expect(
      screen.getByText('Export failed: FILE_WRITE_FAILED.'),
    ).toBeOnTheScreen(),
  );
  expect(mockSaveWallpaper).not.toHaveBeenCalled();
});

test('renders again for a separate completed action, but reuses a service-failed export on Retry', async () => {
  mockSaveWallpaper.mockRejectedValueOnce({ code: 'SAVE_FAILED' });
  render(
    <WallpaperActions composition={composition} fontProvider={fontProvider} />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Save wallpaper' }));
  await waitFor(() => expect(mockSaveWallpaper).toHaveBeenCalledTimes(1));
  fireEvent.press(
    screen.getByRole('button', { name: 'Retry wallpaper action' }),
  );
  await waitFor(() => expect(mockSaveWallpaper).toHaveBeenCalledTimes(2));
  expect(mockExportWallpaper).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByRole('button', { name: 'Save wallpaper' }));
  await waitFor(() => expect(mockSaveWallpaper).toHaveBeenCalledTimes(3));
  expect(mockExportWallpaper).toHaveBeenCalledTimes(2);
});

test('re-exports a missing retry file and exposes settings only after permanent denial', async () => {
  mockSaveWallpaper
    .mockRejectedValueOnce({ code: 'FILE_NOT_FOUND' })
    .mockRejectedValueOnce({ code: 'PERMISSION_DENIED', canAskAgain: false });
  render(
    <WallpaperActions composition={composition} fontProvider={fontProvider} />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Save wallpaper' }));
  await waitFor(() => expect(mockSaveWallpaper).toHaveBeenCalledTimes(1));
  fireEvent.press(
    screen.getByRole('button', { name: 'Retry wallpaper action' }),
  );
  await waitFor(() => expect(mockSaveWallpaper).toHaveBeenCalledTimes(2));
  expect(mockExportWallpaper).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole('button', { name: 'Open app settings' }),
  ).toBeOnTheScreen();
});
