/* eslint-disable @typescript-eslint/no-require-imports */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import HomeScreen from '../index';
import { useAppStore } from '../../src/store/useAppStore';
import { createDefaultPersistedAppState } from '../../src/store/schema';

jest.mock('../../src/features/wallpaper/WallpaperCanvas', () => {
  const { View } = require('react-native');
  return {
    WallpaperCanvas: () => (
      <View accessible accessibilityLabel="Wallpaper preview" />
    ),
  };
});
jest.mock('../../src/features/wallpaper/useWallpaperFonts', () => ({
  useWallpaperFonts: jest.fn(() => ({})),
}));
const mockUseWallpaperFonts = jest.requireMock(
  '../../src/features/wallpaper/useWallpaperFonts',
).useWallpaperFonts as jest.Mock;

beforeEach(() => {
  jest.mocked(router.push).mockClear();
  mockUseWallpaperFonts.mockReturnValue({});
  useAppStore.setState(createDefaultPersistedAppState());
});

test('Home changes the quote and favorite state through accessible controls', () => {
  render(<HomeScreen />);
  const initialQuoteId = useAppStore.getState().currentQuoteId;

  fireEvent.press(screen.getByLabelText('Next quote'));
  expect(useAppStore.getState().currentQuoteId).not.toBe(initialQuoteId);

  fireEvent.press(screen.getByLabelText('Favorite quote'));
  expect(useAppStore.getState().favoriteQuoteIds).toContain(
    useAppStore.getState().currentQuoteId,
  );

  fireEvent.press(screen.getByLabelText('Random quote'));
  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});

test('Home pushes each focused Stack route and keeps unavailable actions disabled', () => {
  render(<HomeScreen />);

  fireEvent.press(screen.getByLabelText('Customize wallpaper'));
  fireEvent.press(screen.getByLabelText('Open favorites'));
  fireEvent.press(screen.getByLabelText('Open automation'));
  fireEvent.press(screen.getByLabelText('Open settings'));

  expect(router.push).toHaveBeenCalledWith('/customize');
  expect(router.push).toHaveBeenCalledWith('/favorites');
  expect(router.push).toHaveBeenCalledWith('/automation');
  expect(router.push).toHaveBeenCalledWith('/settings');
  expect(screen.getByRole('button', { name: 'Save wallpaper' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Set wallpaper' })).toBeDisabled();
  expect(
    screen.getByText(
      'Saving and setting wallpapers arrives with Android support in Task 6.',
    ),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText('Next quote').props.accessibilityHint).toContain(
    'next',
  );
});

test('Home exposes branded loading and a retryable render error without losing state', () => {
  mockUseWallpaperFonts.mockReturnValue(null);
  const { unmount } = render(<HomeScreen />);
  expect(screen.getByText('Preparing your wallpaper')).toBeOnTheScreen();
  unmount();

  mockUseWallpaperFonts.mockReturnValue({});
  useAppStore.setState({ currentQuoteId: 'missing-quote' });
  render(<HomeScreen />);
  expect(screen.getByText('Preview could not render.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Retry preview' }));
  expect(useAppStore.getState().currentQuoteId).toBe('missing-quote');
  expect(screen.getByText('Preview could not render.')).toBeOnTheScreen();
});
