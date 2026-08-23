import { createComposition } from '../composition';
import { getPresetById } from '../presetRepository';
import { drawWallpaperScene } from '../scene';
import type { Quote } from '../../quotes/types';

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
        Make: () => ({
          addText: () => undefined,
          build: () => paragraph,
        }),
      },
      Shader: { MakeLinearGradient: () => undefined },
    },
    TextAlign: { Left: 0, Center: 1, Right: 2 },
    TileMode: { Clamp: 0 },
  };
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
