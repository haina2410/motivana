import { createComposition } from '../composition';
import { getPresetById } from '../presetRepository';
import { drawWallpaperScene } from '../scene';
import type { Quote } from '../../quotes/types';

const paragraphStyles: Record<string, unknown>[] = [];

jest.mock('@shopify/react-native-skia', () => {
  const paragraph = {
    layout: () => undefined,
    paint: () => undefined,
  };
  return {
    Skia: {
      Color: (color: string) => color,
      Paint: () => ({
        setColor: () => undefined,
        setAlphaf: () => undefined,
        setShader: () => undefined,
      }),
      XYWHRect: (x: number, y: number, width: number, height: number) => ({
        x,
        y,
        width,
        height,
      }),
      Point: (x: number, y: number) => ({ x, y }),
      ParagraphBuilder: {
        Make: (style: Record<string, unknown>) => {
          paragraphStyles.push(style);
          return {
            addText: () => undefined,
            build: () => paragraph,
          };
        },
      },
      Shader: { MakeLinearGradient: () => undefined },
    },
    TextAlign: { Left: 0, Center: 1, Right: 2 },
    TileMode: { Clamp: 0 },
  };
});

beforeEach(() => {
  paragraphStyles.length = 0;
});

const quote: Quote = {
  id: 'scene-quote',
  text: 'Small steps completed with care build lasting confidence.',
  author: 'Motivana',
  category: 'confidence',
};

// Mutation caught: assuming every native Skia handle exposes dispose() makes a successful render fail during cleanup.
test('renders when Skia paragraph handles are lifecycle-managed by the native boundary', () => {
  const composition = createComposition({
    quote,
    preset: getPresetById('paper-confidence')!,
    width: 1080,
    height: 2400,
  });
  const canvas = {
    drawRect: () => undefined,
    drawCircle: () => undefined,
  };

  expect(() => drawWallpaperScene(canvas, composition)).not.toThrow();
});

// Mutation caught: using the estimated composition line count as a native paragraph limit clips real wrapped text without ellipsis.
test.each([
  ['midnight-focus', 1080, 1920],
  ['forest-discipline', 1080, 2400],
  ['paper-confidence', 1440, 2560],
])(
  'does not cap a non-truncated %s quote paragraph at %ix%i',
  (presetId, width, height) => {
    const composition = createComposition({
      quote: { ...quote, text: `${quote.text} `.repeat(12) },
      preset: getPresetById(presetId)!,
      width,
      height,
    });
    const canvas = { drawRect: () => undefined, drawCircle: () => undefined };

    expect(composition.truncated).toBe(false);
    drawWallpaperScene(canvas, composition);

    expect(paragraphStyles[0]).not.toHaveProperty('maxLines');
    expect(paragraphStyles[0]).not.toHaveProperty('ellipsis');
  },
);

// Mutation caught: omitting the preset weight silently renders Inter/Lora/Oswald with fallback typography.
test.each([
  ['violet-growth', 400],
  ['forest-discipline', 600],
  ['paper-confidence', 500],
])('passes the %s font weight to Skia', (presetId, weight) => {
  const composition = createComposition({
    quote,
    preset: getPresetById(presetId)!,
    width: 1080,
    height: 2400,
  });
  drawWallpaperScene(
    { drawRect: () => undefined, drawCircle: () => undefined },
    composition,
  );

  expect(paragraphStyles[0]).toMatchObject({
    textStyle: { fontStyle: { weight } },
  });
});
