import { createComposition, type TextMeasurer } from '../composition';
import type { Quote } from '../../quotes/types';
import { getPresetById } from '../presetRepository';

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
