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

beforeEach(() => {
  jest.mocked(router.push).mockClear();
  jest.mocked(router.navigate).mockClear();
  mockUseWallpaperFonts.mockReturnValue({});
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

test('Home changes the favorite state through accessible controls', async () => {
  render(<HomeScreen />);

  fireEvent.press(screen.getByLabelText(t('en', 'home.favorite.add.label')));
  await waitFor(() =>
    expect(useAppStore.getState().favoriteQuoteIds).toContain(
      useAppStore.getState().currentQuoteId,
    ),
  );

  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});

// Mutation caught: pointing Restyle back at a deleted style route would dead-end the only path to the templates.
test('Home reaches settings and the presets, and opens the wallpaper target sheet', () => {
  render(<HomeScreen />);

  fireEvent.press(screen.getByLabelText(t('en', 'home.settings.label')));
  expect(router.push).toHaveBeenCalledWith('/settings');
  fireEvent.press(screen.getByLabelText(t('en', 'home.restyle.label')));
  expect(router.navigate).toHaveBeenCalledWith('/customize');

  expect(screen.queryByText('target sheet')).toBeNull();
  fireEvent.press(screen.getByLabelText(t('en', 'home.set.label')));
  expect(screen.getByText('target sheet')).toBeOnTheScreen();
});

// Mutation caught: leaving the deck on tap-to-advance strands the reader, because the full-bleed card has no visible tap target and no way back.
test('the deck advances and rewinds through the pager', () => {
  const advanceDeck = jest.fn().mockResolvedValue(true);
  const rewindDeck = jest.fn().mockResolvedValue(true);
  useAppStore.setState({ advanceDeck, rewindDeck });
  render(<HomeScreen />);

  const deck = screen.getByLabelText(t('en', 'home.deck.next.label'));
  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'activate' },
  });
  expect(advanceDeck).toHaveBeenCalledTimes(1);

  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'previous' },
  });
  expect(rewindDeck).toHaveBeenCalledTimes(1);
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
