import { createComposition, type TextMeasurer } from '../composition';
import type { Quote } from '../../quotes/types';
import { getPresetById } from '../presetRepository';

const goldenFixture =
  require('../../../../assets/data/renderer-golden-fixture.json') as {
    foregroundTolerance: number;
    cases: {
      quote: Quote;
      preset: string;
      dimensions: { width: number; height: number };
      expected: {
        foreground: {
          quoteBox: { x: number; y: number; width: number; height: number };
          fontSize: number;
          lineCount: number;
          maxLines: number;
          alignment: string;
          authorY: number | null;
          truncated: boolean;
          ellipsis: boolean;
          accent: { x: number; y: number; radius: number };
        };
      };
    }[];
  };

const preset = getPresetById('midnight-focus')!;

const measuredByCharacters: TextMeasurer = {
  measure: (text, width, fontSize, lineHeight) => {
    const charactersPerLine = Math.floor(width / (fontSize * 0.5));
    const lineCount = Math.ceil(text.length / charactersPerLine);
    return { height: lineCount * lineHeight, lineCount };
  },
};

function quoteOfLength(length: number): Quote {
  return {
    id: `quote-${length}`,
    text: 'A'.repeat(length),
    author: 'Author',
    category: 'motivation',
  };
}

// Mutation caught: changing safe margins or using a preview-only width would make geometry differ from the normalized export contract.
test('derives the 9:20 safe margins and quote box from the requested pixels', () => {
  const composition = createComposition(
    { quote: quoteOfLength(30), preset, width: 1080, height: 2400 },
    measuredByCharacters,
  );

  expect(composition.quoteBounds.x).toBeCloseTo(86.4);
  expect(composition.quoteBounds.y).toBeCloseTo(950.58);
  expect(composition.quoteBounds.width).toBeCloseTo(907.2);
  expect(composition.quoteBounds.height).toBeCloseTo(162.84);
  expect(composition.authorY).toBeCloseTo(1166.22);
  expect(composition.quoteFontSize).toBe(69);
  expect(composition.authorFontSize).toBe(30);
  expect(composition.maxQuoteLines).toBe(2);
  expect(composition.truncated).toBe(false);
});

// Mutation caught: failing to move the combined quote/author block into the safe area would overlap the bottom margin for long text.
test.each([
  [30, 1080, 1920],
  [80, 1080, 1920],
  [150, 1080, 2400],
  [250, 1080, 2400],
])(
  'keeps a %i-character quote inside portrait safe bounds without author overlap',
  (length, width, height) => {
    const composition = createComposition(
      { quote: quoteOfLength(length), preset, width, height },
      measuredByCharacters,
    );
    const top = height * 0.1;
    const bottom = height * 0.9;
    const authorLineHeight = composition.authorFontSize * 1.2;

    expect(composition.quoteBounds.x).toBeCloseTo(width * 0.08);
    expect(composition.quoteBounds.width).toBeCloseTo(width * 0.84);
    expect(composition.quoteBounds.y).toBeGreaterThanOrEqual(top);
    expect(
      composition.quoteBounds.y + composition.quoteBounds.height,
    ).toBeLessThanOrEqual(bottom);
    expect(composition.authorY).toBeGreaterThanOrEqual(
      composition.quoteBounds.y +
        composition.quoteBounds.height +
        height * 0.022,
    );
    expect(composition.authorY + authorLineHeight).toBeLessThanOrEqual(bottom);
  },
);

// Mutation caught: omitting quote and preset identity from the cache key would overwrite a visually different export.
test('creates a stable cache key for the same quote, preset, and dimensions', () => {
  const first = createComposition(
    { quote: quoteOfLength(80), preset, width: 1080, height: 2400 },
    measuredByCharacters,
  );
  const second = createComposition(
    { quote: quoteOfLength(80), preset, width: 1080, height: 2400 },
    measuredByCharacters,
  );

  expect(first.cacheKey).toBe('midnight-focus-quote-80-1080x2400');
  expect(second.cacheKey).toBe(first.cacheKey);
});

test('loads every shared renderer golden fixture with frozen Task4 geometry', () => {
  for (const golden of goldenFixture.cases) {
    const goldenPreset = getPresetById(golden.preset)!;
    const composition = createComposition({
      quote: golden.quote,
      preset: goldenPreset,
      ...golden.dimensions,
    });
    const expected = golden.expected.foreground;
    const tolerance = goldenFixture.foregroundTolerance;
    const markSize = composition.quoteFontSize * 1.5;
    const markX =
      goldenPreset.textAlign === 'right'
        ? composition.quoteBounds.x + composition.quoteBounds.width - markSize
        : composition.quoteBounds.x;
    expect(
      Math.abs(composition.quoteBounds.x - expected.quoteBox.x),
    ).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(composition.quoteBounds.y - expected.quoteBox.y),
    ).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(composition.quoteBounds.width - expected.quoteBox.width),
    ).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(composition.quoteBounds.height - expected.quoteBox.height),
    ).toBeLessThanOrEqual(tolerance);
    expect(composition.quoteFontSize).toBe(expected.fontSize);
    expect(composition.maxQuoteLines).toBe(expected.maxLines);
    expect(composition.maxQuoteLines).toBe(expected.lineCount);
    expect(goldenPreset.textAlign).toBe(expected.alignment);
    expect(composition.truncated).toBe(expected.truncated);
    expect(composition.truncated).toBe(expected.ellipsis);
    if (expected.authorY === null) {
      expect(golden.quote.author).toBeNull();
    } else {
      expect(
        Math.abs(composition.authorY - expected.authorY),
      ).toBeLessThanOrEqual(tolerance);
    }
    expect(
      Math.abs(markX + markSize / 2 - expected.accent.x),
    ).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(composition.quoteBounds.y - markSize / 3 - expected.accent.y),
    ).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(markSize / 10 - expected.accent.radius),
    ).toBeLessThanOrEqual(tolerance);
  }
});
