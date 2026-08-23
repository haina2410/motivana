import { createComposition } from '../composition';
import { createPreviewDataUri, createPreviewImage } from '../WallpaperCanvas';
import { getPresetById } from '../presetRepository';
import type { Quote } from '../../quotes/types';

let disposed = false;

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Image: () => null,
  Skia: {
    Surface: {
      MakeOffscreen: () => ({
        getCanvas: () => ({}),
        flush: () => undefined,
        makeImageSnapshot: () => ({
          encodeToBase64: () => 'cG5n',
          dispose: () => undefined,
        }),
        dispose: () => {
          disposed = true;
        },
      }),
    },
  },
  useFonts: () => null,
}));
jest.mock('../scene', () => ({ drawWallpaperScene: () => undefined }));

const quote: Quote = {
  id: 'preview-quote',
  text: 'Progress is built by making one clear decision at a time.',
  author: 'Motivana',
  category: 'growth',
};

beforeEach(() => {
  disposed = false;
});

// Mutation caught: routing Android through the unstable Skia TextureView would leave a valid scene visibly blank.
test('encodes the shared Skia scene as a displayable PNG data URI for Android preview fallback', () => {
  const uri = createPreviewDataUri(
    createComposition({
      quote,
      preset: getPresetById('midnight-focus')!,
      width: 270,
      height: 600,
    }),
    {} as never,
  );

  expect(uri).toBe('data:image/png;base64,cG5n');
  expect(disposed).toBe(true);
});

// Mutation caught: disposing the offscreen surface before Canvas consumes its snapshot produces an empty preview.
test('keeps the offscreen surface alive for the preview image lifetime', () => {
  const preview = createPreviewImage(
    createComposition({
      quote,
      preset: getPresetById('midnight-focus')!,
      width: 270,
      height: 600,
    }),
    {} as never,
  );

  expect(preview?.image).toBeDefined();
  expect(disposed).toBe(false);
});
