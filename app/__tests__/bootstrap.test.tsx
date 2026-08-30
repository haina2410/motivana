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
  useWallpaperFonts: () => ({ provider: {}, failed: false, retry: () => {} }),
}));
// The sheet and the Save action both reach the Skia exporter, which needs the
// native module.
jest.mock('../../src/components/SetWallpaperSheet', () => ({
  SetWallpaperSheet: () => null,
}));
jest.mock('../../src/features/wallpaper/exportWallpaper', () => ({
  exportWallpaper: jest.fn(),
}));
// The next-card prefetch reaches Skia, which needs the native module.
jest.mock('../../src/features/wallpaper/useBackgroundImage', () => ({
  useBackgroundImage: () => null,
  getBackgroundImage: jest.fn().mockResolvedValue(undefined),
}));

test('renders the deck header and the live wallpaper card', () => {
  render(<HomeScreen />);

  expect(screen.getByText('MOTIVANA')).toBeOnTheScreen();
  // The deck mounts a card ahead of the reader too, so the live wallpaper is
  // the first preview rather than the only one.
  expect(screen.getAllByLabelText('Wallpaper preview')[0]).toBeOnTheScreen();
});
