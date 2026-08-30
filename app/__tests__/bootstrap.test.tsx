/* eslint-disable @typescript-eslint/no-require-imports */

import { render, screen } from '@testing-library/react-native';
import HomeScreen from '../(tabs)/index';
import { t } from '../../src/features/i18n/t';

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
// The sheet reaches the Skia exporter, which needs the native module.
jest.mock('../../src/components/SetWallpaperSheet', () => ({
  SetWallpaperSheet: () => null,
}));

test('renders the deck header and the live wallpaper card', () => {
  render(<HomeScreen />);

  expect(screen.getByText(t('en', 'home.today'))).toBeOnTheScreen();
  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});
