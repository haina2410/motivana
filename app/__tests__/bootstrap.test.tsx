/* eslint-disable @typescript-eslint/no-require-imports */

import { render, screen } from '@testing-library/react-native';
import HomeScreen from '../(tabs)/index';

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
// The sheet and the Save action both reach the Skia exporter, which needs the
// native module.
jest.mock('../../src/components/SetWallpaperSheet', () => ({
  SetWallpaperSheet: () => null,
}));
jest.mock('../../src/features/wallpaper/exportWallpaper', () => ({
  exportWallpaper: jest.fn(),
}));

test('renders the deck header and the live wallpaper card', () => {
  render(<HomeScreen />);

  expect(screen.getByText('MOTIVANA')).toBeOnTheScreen();
  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});
