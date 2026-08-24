import { createComposition } from '../composition';
import { getPresetById } from '../presetRepository';
import { drawWallpaperScene } from '../scene';
import type { Quote } from '../../quotes/types';

const paragraphStyles: Record<string, unknown>[] = [];
const gradientCalls: {
  start: { x: number; y: number };
  end: { x: number; y: number };
}[] = [];

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
      Shader: {
        MakeLinearGradient: (
          start: { x: number; y: number },
          end: { x: number; y: number },
        ) => {
          gradientCalls.push({ start, end });
          return undefined;
        },
      },
    },
    TextAlign: { Left: 0, Center: 1, Right: 2 },
    TileMode: { Clamp: 0 },
  };
});

beforeEach(() => {
  paragraphStyles.length = 0;
  gradientCalls.length = 0;
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

// Mutation caught: omitting the canonical line budget lets a platform text shaper
// extend outside the shared safe box even when the deterministic composition fits.
test.each([
  ['midnight-focus', 1080, 1920],
  ['forest-discipline', 1080, 2400],
  ['paper-confidence', 1440, 2560],
])(
  'caps a non-truncated %s quote paragraph at its canonical line budget at %ix%i',
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

    expect(paragraphStyles[0]).toMatchObject({
      maxLines: composition.maxQuoteLines,
    });
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

// Mutation caught: treating every gradient as top-left to bottom-right ignores the
// configured screen-space angle and reverses native Canvas gradient direction.
test('uses the configured 90-degree gradient axis in screen coordinates', () => {
  const preset = getPresetById('midnight-focus')!;
  const composition = createComposition({
    quote,
    preset: {
      ...preset,
      background: {
        kind: 'linear-gradient',
        startColor: '#102A56',
        endColor: '#020617',
        angleDegrees: 90,
      },
    },
    width: 1080,
    height: 1440,
  });

  drawWallpaperScene(
    { drawRect: () => undefined, drawCircle: () => undefined },
    composition,
  );

  expect(gradientCalls).toHaveLength(1);
  expect(gradientCalls[0]!.start).toEqual({ x: 540, y: -180 });
  expect(gradientCalls[0]!.end).toEqual({ x: 540, y: 1620 });
});
