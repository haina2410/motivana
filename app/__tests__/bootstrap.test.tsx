/* eslint-disable @typescript-eslint/no-require-imports */

import { render, screen } from '@testing-library/react-native';
import HomeScreen from '../index';

jest.mock('../../src/features/wallpaper/WallpaperCanvas', () => {
  const { View } = require('react-native');
  return {
    WallpaperCanvas: () =>
      require('react').createElement(View, {
        accessible: true,
        accessibilityLabel: 'Wallpaper preview',
      }),
  };
});
jest.mock('../../src/features/wallpaper/useWallpaperFonts', () => ({
  useWallpaperFonts: () => ({}),
}));

test('renders the product name and loading preview state', () => {
  render(<HomeScreen />);

  expect(screen.getByText('Motivana')).toBeOnTheScreen();
  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});
