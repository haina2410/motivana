import { createComposition } from '../composition';
import { getPresetById } from '../presetRepository';
import { drawWallpaperScene, measureSkiaComposition } from '../scene';
import { quoteText, type Quote } from '../../quotes/types';
import type { Locale } from '../../i18n/locale';

const goldenFixture =
  require('../../../../assets/data/renderer-golden-fixture.json') as {
    layoutTolerance: number;
    cases: {
      quote: Quote;
      preset: string;
      dimensions: { width: number; height: number };
      locale?: Locale;
      expected: {
        quoteBox: { x: number; y: number; width: number; height: number };
        fontSize: number;
        lineCount: number;
        maxLines: number;
        authorY: number | null;
        truncated: boolean;
      };
    }[];
  };

const paragraphStyles: Record<string, unknown>[] = [];
const gradientCalls: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  colors?: unknown[];
  positions?: number[] | null;
}[] = [];
let mockParagraphText = '';
const mockGoldenMeasurements = new Map<
  string,
  { height: number; lineCount: number }
>();

jest.mock('@shopify/react-native-skia', () => {
  const makeParagraph = (style: Record<string, unknown>, text: string) => ({
    layout: () => undefined,
    paint: () => undefined,
    getHeight: () => {
      const measurement = mockGoldenMeasurements.get(
        `${text}|${(style.textStyle as { fontSize?: number }).fontSize}|${
          'maxLines' in style ? `capped-${style.maxLines}` : 'uncapped'
        }`,
      );
      if (measurement) return measurement.height;
      const fontSize = (style.textStyle as { fontSize?: number } | undefined)
        ?.fontSize;
      return fontSize && fontSize >= 40 ? 5_000 : 40;
    },
    getLineMetrics: () => {
      const measurement = mockGoldenMeasurements.get(
        `${text}|${(style.textStyle as { fontSize?: number }).fontSize}|${
          'maxLines' in style ? `capped-${style.maxLines}` : 'uncapped'
        }`,
      );
      return Array.from({ length: measurement?.lineCount ?? 2 }, () => ({}));
    },
  });
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
          mockParagraphText = '';
          return {
            addText: (text: string) => {
              mockParagraphText = text;
            },
            build: () => makeParagraph(style, mockParagraphText),
          };
        },
      },
      Shader: {
        MakeLinearGradient: (
          start: { x: number; y: number },
          end: { x: number; y: number },
          colors?: unknown[],
          positions?: number[] | null,
        ) => {
          gradientCalls.push({ start, end, colors, positions });
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
  mockGoldenMeasurements.clear();
});

const quote: Quote = {
  id: 'scene-quote',
  category: 'confidence',
  sourceLocale: 'en',
  text: { en: 'Small steps completed with care build lasting confidence.' },
  author: 'Motivana',
};

// Mutation caught: assuming every native Skia handle exposes dispose() makes a successful render fail during cleanup.
test('renders when Skia paragraph handles are lifecycle-managed by the native boundary', () => {
  const composition = createComposition({
    quote,
    preset: getPresetById('paper-confidence')!,
    width: 1080,
    height: 2400,
    locale: 'en',
  });
  const canvas = {
    drawRect: () => undefined,
    drawCircle: () => undefined,
  };

  expect(() => drawWallpaperScene(canvas, composition)).not.toThrow();
});

// Mutation caught: a character heuristic line budget can be smaller than the
// real Skia shaping result for wide glyphs, silently dropping an untruncated
// quote. Only an exhausted minimum-size fit may install a cap/ellipsis.
test.each([
  ['midnight-focus', 1080, 1920],
  ['forest-discipline', 1080, 2400],
  ['paper-confidence', 1440, 2560],
])(
  'does not cap a non-truncated %s quote paragraph at %ix%i',
  (presetId, width, height) => {
    const composition = createComposition({
      quote: {
        ...quote,
        text: { en: `${quoteText(quote, 'en')} `.repeat(12) },
      },
      preset: getPresetById(presetId)!,
      width,
      height,
      locale: 'en',
    });
    const canvas = { drawRect: () => undefined, drawCircle: () => undefined };

    expect(composition.truncated).toBe(false);
    drawWallpaperScene(canvas, composition);

    expect(paragraphStyles[0]).not.toHaveProperty('maxLines');
    expect(paragraphStyles[0]).not.toHaveProperty('ellipsis');
  },
);

// Mutation caught: reverting this fixture path to createComposition's character
// fallback would no longer reproduce the bundled-font Skia baseline.
//
// Note on the `vietnamese-locale-layout-*` cases: this test's Skia mock is
// driven entirely by the fixture's own `expected` numbers (see the
// character-count measurer used to generate them), so it cannot detect
// tone-mark clipping in a light Cormorant Garamond — that measurer has no per-glyph
// height model. Those two cases only prove the locale-aware layout pipeline
// (createComposition/fitText picking up `locale: 'vi'` text) stays wired.
// Visual tone-mark clipping still needs an on-device check.
test('matches the recorded bundled-font Skia foreground fixture', () => {
  for (const golden of goldenFixture.cases) {
    const expected = golden.expected;
    const locale = golden.locale ?? 'en';
    const key = `${quoteText(golden.quote, locale)}|${expected.fontSize}`;
    for (
      let fontSize = Math.round(
        golden.dimensions.width *
          getPresetById(golden.preset)!.preferredFontSizeRatio,
      );
      fontSize > expected.fontSize;
      fontSize -= 1
    ) {
      mockGoldenMeasurements.set(
        `${quoteText(golden.quote, locale)}|${fontSize}|uncapped`,
        {
          height: 5_000,
          lineCount: 99,
        },
      );
    }
    if (expected.truncated) {
      mockGoldenMeasurements.set(`${key}|uncapped`, {
        height: 5_000,
        lineCount: 99,
      });
      mockGoldenMeasurements.set(`${key}|capped-${expected.maxLines + 1}`, {
        height: 5_000,
        lineCount: expected.maxLines + 1,
      });
      mockGoldenMeasurements.set(`${key}|capped-${expected.maxLines}`, {
        height: expected.quoteBox.height,
        lineCount: expected.lineCount,
      });
    } else {
      mockGoldenMeasurements.set(`${key}|uncapped`, {
        height: expected.quoteBox.height,
        lineCount: expected.lineCount,
      });
    }
    const measured = measureSkiaComposition(
      createComposition({
        quote: golden.quote,
        preset: getPresetById(golden.preset)!,
        ...golden.dimensions,
        locale,
      }),
      {} as never,
    );
    const tolerance = goldenFixture.layoutTolerance;
    expect(
      Math.abs(measured.quoteBounds.x - expected.quoteBox.x),
    ).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(measured.quoteBounds.y - expected.quoteBox.y),
    ).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(measured.quoteBounds.width - expected.quoteBox.width),
    ).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(measured.quoteBounds.height - expected.quoteBox.height),
    ).toBeLessThanOrEqual(tolerance);
    expect(measured.quoteFontSize).toBe(expected.fontSize);
    expect(measured.maxQuoteLines).toBe(expected.maxLines);
    expect(measured.truncated).toBe(expected.truncated);
    if (expected.authorY !== null) {
      expect(Math.abs(measured.authorY - expected.authorY)).toBeLessThanOrEqual(
        tolerance,
      );
    }
  }
});

// Mutation caught: routing fit decisions through the character-count fallback
// lets a wide glyph, an unbroken word, or a surrogate pair render at a size that
// the actual Skia paragraph cannot fit.
test.each([
  'ＭＷ'.repeat(40),
  'pneumonoultramicroscopicsilicovolcanoconiosis'.repeat(3),
  '🚀'.repeat(80),
])(
  'measures %s with the Skia paragraph before deciding it is complete',
  (text) => {
    const input = createComposition({
      quote: { ...quote, text: { en: text } },
      preset: getPresetById('midnight-focus')!,
      width: 1080,
      height: 2400,
      locale: 'en',
    });

    const measured = measureSkiaComposition(input, {} as never);
    drawWallpaperScene(
      { drawRect: () => undefined, drawCircle: () => undefined },
      measured,
    );

    expect(measured.quoteFontSize).toBe(39);
    expect(measured.truncated).toBe(false);
    expect(paragraphStyles.at(-2)).not.toHaveProperty('maxLines');
  },
);

// Mutation caught: omitting the preset weight silently renders every bundled family with fallback typography.
test.each([
  ['midnight-focus', 300],
  ['ember-action', 400],
  ['sunrise-drive', 500],
])('passes the %s font weight to Skia', (presetId, weight) => {
  const composition = createComposition({
    quote,
    preset: getPresetById(presetId)!,
    width: 1080,
    height: 2400,
    locale: 'en',
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
    locale: 'en',
  });

  drawWallpaperScene(
    { drawRect: () => undefined, drawCircle: () => undefined },
    composition,
  );

  expect(gradientCalls).toHaveLength(1);
  expect(gradientCalls[0]!.start).toEqual({ x: 540, y: -180 });
  expect(gradientCalls[0]!.end).toEqual({ x: 540, y: 1620 });
});

const imagePreset = () => ({
  ...getPresetById('midnight-focus')!,
  quotePositionY: 0.52,
  background: {
    kind: 'image' as const,
    asset: 'backgrounds/mountain-01.webp',
    scrimColor: '#000000',
    scrimOpacity: 0.6,
    effectiveLuminance: 0.12,
  },
});

const fakeImage = (width = 1290, height = 2796) =>
  ({ width: () => width, height: () => height }) as never;

function imageCanvas() {
  const drawn: { source: unknown; destination: unknown }[] = [];
  return {
    drawn,
    canvas: {
      drawRect: () => undefined,
      drawCircle: () => undefined,
      drawImageRect: (
        _image: unknown,
        source: unknown,
        destination: unknown,
      ) => {
        drawn.push({ source, destination });
      },
    },
  };
}

// Mutation caught: an image preset that only ever paints its stand-in colour
// ships the reader a plain grey wallpaper instead of the photograph.
test('paints the photograph over the whole canvas for an image background', () => {
  const composition = createComposition({
    quote,
    preset: imagePreset(),
    width: 1080,
    height: 2340,
    locale: 'en',
  });
  const { canvas, drawn } = imageCanvas();

  drawWallpaperScene(canvas, composition, undefined, fakeImage());

  expect(drawn).toHaveLength(1);
  expect(drawn[0]!.destination).toEqual({
    x: 0,
    y: 0,
    width: 1080,
    height: 2340,
  });
});

// Mutation caught: stretching the source rectangle to the full image distorts
// a photograph whose aspect ratio differs from the canvas.
test('takes a centred cover crop when the canvas is wider than the photograph', () => {
  const composition = createComposition({
    quote,
    preset: imagePreset(),
    width: 1000,
    height: 1000,
    locale: 'en',
  });
  const { canvas, drawn } = imageCanvas();

  drawWallpaperScene(canvas, composition, undefined, fakeImage(1290, 2796));

  // Square canvas over a tall photograph: full width, a centred square of it.
  expect(drawn[0]!.source).toEqual({
    x: 0,
    y: (2796 - 1290) / 2,
    width: 1290,
    height: 1290,
  });
});

// Mutation caught: drawing the image unconditionally throws on the canvas
// before the decode resolves, taking the whole preview down.
test('falls back to the stand-in fill while the photograph is still decoding', () => {
  const composition = createComposition({
    quote,
    preset: imagePreset(),
    width: 1080,
    height: 2340,
    locale: 'en',
  });
  const { canvas, drawn } = imageCanvas();

  expect(() => drawWallpaperScene(canvas, composition)).not.toThrow();
  expect(drawn).toHaveLength(0);
});

// Mutation caught: a scrim centred on the frame rather than on the quote
// leaves the text on bare photograph whenever the quote sits off centre.
test('peaks the scrim on the quote, not on the middle of the frame', () => {
  const composition = createComposition({
    quote,
    preset: imagePreset(),
    width: 1080,
    height: 2340,
    locale: 'en',
  });
  const { canvas } = imageCanvas();

  drawWallpaperScene(canvas, composition, undefined, fakeImage());

  expect(gradientCalls).toHaveLength(1);
  const scrim = gradientCalls[0]!;
  expect(scrim.start).toEqual({ x: 0, y: 0 });
  expect(scrim.end).toEqual({ x: 0, y: 2340 });
  const positions = scrim.positions!;
  expect(positions).toHaveLength(5);
  [0, 0.1, 0.52, 0.94, 1].forEach((expected, index) => {
    expect(positions[index]!).toBeCloseTo(expected, 6);
  });
  expect(scrim.colors).toEqual([
    'rgba(0, 0, 0, 0)',
    'rgba(0, 0, 0, 0)',
    'rgba(0, 0, 0, 0.6)',
    'rgba(0, 0, 0, 0)',
    'rgba(0, 0, 0, 0)',
  ]);
});

// Mutation caught: letting the scrim stop positions run past 0 or 1 makes
// Skia reject the shader, so the quote loses its contrast entirely.
test('keeps the scrim stops inside the gradient range for a high quote', () => {
  const composition = createComposition({
    quote,
    preset: { ...imagePreset(), quotePositionY: 0.36 },
    width: 1080,
    height: 2340,
    locale: 'en',
  });
  const { canvas } = imageCanvas();

  drawWallpaperScene(canvas, composition, undefined, fakeImage());

  const positions = gradientCalls[0]!.positions!;
  expect(positions[0]).toBe(0);
  expect(positions.at(-1)).toBe(1);
  for (let index = 1; index < positions.length; index += 1) {
    expect(positions[index]!).toBeGreaterThanOrEqual(positions[index - 1]!);
  }
});
