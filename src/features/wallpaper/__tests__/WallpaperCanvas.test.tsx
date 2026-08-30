import { fireEvent, render, screen } from '@testing-library/react-native';

import { createComposition } from '../composition';
import { WallpaperCanvas } from '../WallpaperCanvas';
import { getPresetById } from '../presetRepository';
import type { Quote } from '../../quotes/types';

const recorded: { width: number; height: number }[] = [];
const transforms: unknown[] = [];

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: ({ children }: { children?: unknown }) => children ?? null,
  Group: ({
    children,
    transform,
  }: {
    children?: unknown;
    transform?: unknown;
  }) => {
    transforms.push(transform);
    return children ?? null;
  },
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
  useWallpaperFonts: () => ({ provider: {}, failed: false, retry: () => {} }),
}));
jest.mock('../useBackgroundImage', () => ({
  useBackgroundImage: () => null,
  getBackgroundImage: () => Promise.resolve(undefined),
}));

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
  transforms.length = 0;
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

// Mutation caught: scaling by width alone drops the contain behaviour the old
// <SkiaImage fit="contain"> gave, so a box whose aspect differs from the
// composition's crops instead of letterboxing.
test('picks the height-driven scale when the box is wider than the composition', () => {
  render(<WallpaperCanvas composition={composition()} />);
  const view = screen.getByLabelText('Wallpaper preview');

  // Composition is 270x600 (aspect 0.45); a 300x300 box is much wider than
  // that, so contain must shrink by height (0.5), not width (1.111...).
  fireEvent(view, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } },
  });

  // Contain keeps the box's own top-left anchor, which the preset caption's
  // geometry is derived from.
  expect(transforms.at(-1)).toEqual([
    { translateX: 0 },
    { translateY: 0 },
    { scale: 0.5 },
  ]);
});

// Mutation caught: contain-fitting the deck leaves a band of the screen's own
// background down the long edge, so the wallpaper is not full-bleed.
test('fills the box on both axes when asked to cover', () => {
  render(<WallpaperCanvas composition={composition()} fit="cover" />);
  const view = screen.getByLabelText('Wallpaper preview');

  // 270x600 into a 300x300 box: cover takes the larger ratio, the width-driven
  // 1.111..., so nothing of the box is left uncovered.
  fireEvent(view, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } },
  });

  const scale = 300 / 270;
  expect(transforms.at(-1)).toEqual([
    { translateX: 0 },
    // Half the overflow above and half below, rather than all of it off the
    // bottom edge.
    { translateY: (300 - 600 * scale) / 2 },
    { scale },
  ]);
});
