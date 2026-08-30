/* eslint-disable @typescript-eslint/no-require-imports */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';

import HomeScreen from '../(tabs)/index';
import { useAppStore } from '../../src/store/useAppStore';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { setRotationSynchronizer } from '../../src/store/automationSynchronization';
import { t } from '../../src/features/i18n/t';

jest.mock('../../src/features/wallpaper/WallpaperCanvas', () => {
  const { View } = require('react-native');
  return {
    WallpaperCanvas: jest.fn(() => (
      <View accessible accessibilityLabel="Wallpaper preview" />
    )),
  };
});
jest.mock('../../src/features/wallpaper/useWallpaperFonts', () => ({
  useWallpaperFonts: jest.fn(() => ({})),
}));
jest.mock('../../src/features/wallpaper/exportWallpaper', () => ({
  exportWallpaper: jest.fn(),
}));
jest.mock('../../src/features/wallpaper/exportCache', () => ({
  exportedWallpaperUri: jest.fn(() => undefined),
}));
jest.mock('../../src/services/wallpaperNative', () => ({
  getWallpaperCapabilities: jest.fn(async () => ({
    supportsHome: true,
    supportsLock: false,
  })),
  setWallpaper: jest.fn(),
}));
jest.mock('../../src/components/SetWallpaperSheet', () => {
  const { Text, View } = require('react-native');
  return {
    SetWallpaperSheet: ({ visible }: { visible: boolean }) =>
      visible ? (
        <View>
          <Text>target sheet</Text>
        </View>
      ) : null,
  };
});
const mockUseWallpaperFonts = jest.requireMock(
  '../../src/features/wallpaper/useWallpaperFonts',
).useWallpaperFonts as jest.Mock;
const mockWallpaperCanvas = jest.requireMock(
  '../../src/features/wallpaper/WallpaperCanvas',
).WallpaperCanvas as jest.Mock;
const mockExportedWallpaperUri = jest.requireMock(
  '../../src/features/wallpaper/exportCache',
).exportedWallpaperUri as jest.Mock;

beforeEach(() => {
  jest.mocked(router.push).mockClear();
  jest.mocked(router.navigate).mockClear();
  mockUseWallpaperFonts.mockReturnValue({});
  mockExportedWallpaperUri.mockReturnValue(undefined);
  mockWallpaperCanvas.mockImplementation(() => {
    const { View } = require('react-native');
    return <View accessible accessibilityLabel="Wallpaper preview" />;
  });
  useAppStore.setState(createDefaultPersistedAppState());
  setRotationSynchronizer(async () => undefined);
});

// Mutation caught: swallowing a rejected enabled-automation favorite change leaves users unable to retry the worker snapshot update.
test('Home shows a safe retry when favorite synchronization fails', async () => {
  let attempts = 0;
  setRotationSynchronizer(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('native secret');
  });
  useAppStore.setState({ rotationEnabled: true });
  render(<HomeScreen />);

  fireEvent.press(screen.getByLabelText(t('en', 'home.favorite.add.label')));
  await waitFor(() =>
    expect(screen.getByText(t('en', 'home.favorite.error'))).toBeOnTheScreen(),
  );
  expect(screen.queryByText('native secret')).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'home.favorite.retry.label') }),
  );

  await waitFor(() =>
    expect(screen.getByText(t('en', 'home.favorite.added'))).toBeOnTheScreen(),
  );
  expect(attempts).toBe(2);
});

test('Home changes the quote and favorite state through accessible controls', async () => {
  render(<HomeScreen />);
  const initialQuoteId = useAppStore.getState().currentQuoteId;

  fireEvent.press(screen.getByLabelText('Next quote'));
  expect(useAppStore.getState().currentQuoteId).not.toBe(initialQuoteId);

  fireEvent.press(screen.getByLabelText(t('en', 'home.favorite.add.label')));
  await waitFor(() =>
    expect(useAppStore.getState().favoriteQuoteIds).toContain(
      useAppStore.getState().currentQuoteId,
    ),
  );

  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});

test('Home reaches every other screen and opens the wallpaper target sheet', () => {
  render(<HomeScreen />);

  // Settings sits above the tabs, so it is pushed. Restyle is a tab jump: the
  // presets carry every style the deleted style screen could report.
  fireEvent.press(screen.getByLabelText(t('en', 'home.settings.label')));
  expect(router.push).toHaveBeenCalledWith('/settings');
  fireEvent.press(screen.getByLabelText(t('en', 'home.restyle.label')));
  expect(router.navigate).toHaveBeenCalledWith('/customize');

  expect(screen.queryByText('target sheet')).toBeNull();
  fireEvent.press(screen.getByLabelText(t('en', 'home.set.label')));
  expect(screen.getByText('target sheet')).toBeOnTheScreen();

  expect(screen.getByLabelText('Next quote').props.accessibilityHint).toContain(
    'random',
  );
});

test('Home exposes branded loading and a retryable render error without losing state', () => {
  mockUseWallpaperFonts.mockReturnValue(null);
  const { unmount } = render(<HomeScreen />);
  expect(screen.getByText(t('en', 'home.loading'))).toBeOnTheScreen();
  unmount();

  mockUseWallpaperFonts.mockReturnValue({});
  useAppStore.setState({ currentQuoteId: 'missing-quote' });
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<HomeScreen />);
    expect(screen.getByText(t('en', 'home.preview.error'))).toBeOnTheScreen();
    fireEvent.press(
      screen.getByRole('button', { name: t('en', 'home.preview.retry.label') }),
    );
    expect(useAppStore.getState().currentQuoteId).toBe('missing-quote');
    expect(screen.getByText(t('en', 'home.preview.error'))).toBeOnTheScreen();
  } finally {
    errorSpy.mockRestore();
  }
});

test('Home catches a thrown preview render and retries without changing the quote or preset', () => {
  let shouldThrow = true;
  mockWallpaperCanvas.mockImplementation(() => {
    if (shouldThrow) {
      throw new Error('Canvas failed to draw');
    }
    const { View } = require('react-native');
    return <View accessible accessibilityLabel="Wallpaper preview" />;
  });
  const before = useAppStore.getState();
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  try {
    render(<HomeScreen />);
    expect(screen.getByText(t('en', 'home.preview.error'))).toBeOnTheScreen();

    shouldThrow = false;
    fireEvent.press(
      screen.getByRole('button', { name: t('en', 'home.preview.retry.label') }),
    );

    expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
    expect(useAppStore.getState().currentQuoteId).toBe(before.currentQuoteId);
    expect(useAppStore.getState().selectedPresetId).toBe(
      before.selectedPresetId,
    );
  } finally {
    errorSpy.mockRestore();
  }
});

// Mutation caught: waiting for the typefaces even with an exported wallpaper on
// disk would hold the spinner through the whole Skia font load at every launch.
test('Home shows the exported wallpaper before the typefaces load', () => {
  mockUseWallpaperFonts.mockReturnValue(null);
  mockExportedWallpaperUri.mockReturnValue(
    'file:///cache/motivana-exports/applied.png',
  );

  render(<HomeScreen />);

  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
  expect(screen.queryByText(t('en', 'home.loading'))).toBeNull();
});
