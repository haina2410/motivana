import { render, screen } from '@testing-library/react-native';

import { createComposition } from '../composition';
import { WallpaperCanvas } from '../WallpaperCanvas';
import { getPresetById } from '../presetRepository';
import type { Quote } from '../../quotes/types';

const recorded: { width: number; height: number }[] = [];

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: ({ children }: { children?: unknown }) => children ?? null,
  Group: ({ children }: { children?: unknown }) => children ?? null,
  Picture: () => null,
  Skia: {
    XYWHRect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
    PictureRecorder: () => ({
      beginRecording: (rect: { width: number; height: number }) => {
        recorded.push({ width: rect.width, height: rect.height });
        return {};
      },
      finishRecordingAsPicture: () => ({ picture: true }),
    }),
  },
  useFonts: () => null,
}));
jest.mock('../scene', () => ({
  drawWallpaperScene: () => undefined,
  measureSkiaComposition: (composition: unknown) => composition,
}));
jest.mock('../useWallpaperFonts', () => ({
  useWallpaperFonts: () => ({}),
}));
jest.mock('../useBackgroundImage', () => ({
  useBackgroundImage: () => null,
  getBackgroundImage: () => Promise.resolve(undefined),
}));
jest.mock('../exportCache', () => ({ exportedWallpaperUri: () => undefined }));

const quote: Quote = {
  id: 'preview-quote',
  category: 'growth',
  sourceLocale: 'en',
  text: { en: 'Progress is built by making one clear decision at a time.' },
  author: 'Motivana',
};

const composition = () =>
  createComposition({
    quote,
    preset: getPresetById('midnight-focus')!,
    width: 270,
    height: 600,
    locale: 'en',
  });

beforeEach(() => {
  recorded.length = 0;
});

// Mutation caught: rasterising to an offscreen surface renders blank on Android, because a snapshot cannot cross the GPU context boundary.
test('records the scene at composition size rather than encoding a bitmap', () => {
  render(<WallpaperCanvas composition={composition()} />);

  expect(recorded).toEqual([{ width: 270, height: 600 }]);
});

// Mutation caught: dropping the accessibility label leaves the deck unreachable by name for a screen reader.
test('labels the preview for assistive technology', () => {
  render(<WallpaperCanvas composition={composition()} />);

  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});
