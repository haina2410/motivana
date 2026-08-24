import { createComposition, type TextMeasurer } from '../composition';
import type { Quote } from '../../quotes/types';
import { getAllPresets, getPresetById } from '../presetRepository';

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

// Mutation caught: changing a shared fitting constant for only one renderer can
// leave a particular alignment or the 274/minimum-size boundary unprotected.
test('keeps every alignment and stress length in the 1080x2400 canonical safe box', () => {
  const lengths = [30, 80, 150, 274];
  const alignments = new Set(
    getAllPresets().map((current) => current.textAlign),
  );
  expect(alignments).toEqual(new Set(['left', 'center', 'right']));

  for (const current of getAllPresets()) {
    for (const length of lengths) {
      const composition = createComposition({
        quote: quoteOfLength(length),
        preset: current,
        width: 1080,
        height: 2400,
      });
      expect(composition.quoteBounds.y).toBeGreaterThanOrEqual(240);
      expect(
        composition.quoteBounds.y + composition.quoteBounds.height,
      ).toBeLessThanOrEqual(2160);
      expect(composition.maxQuoteLines).toBeGreaterThan(0);
    }

    const stress = createComposition({
      quote: quoteOfLength(2_000),
      preset: current,
      width: 1080,
      height: 2400,
    });
    expect(stress.quoteFontSize).toBe(
      Math.round(1080 * current.minimumFontSizeRatio),
    );
    expect(stress.truncated).toBe(true);
    expect(stress.maxQuoteLines).toBeGreaterThan(0);
  }
});

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

  expect(first.cacheKey).toMatch(
    /^midnight-focus-quote-80-1080x2400-[0-9a-z]+$/,
  );
  expect(second.cacheKey).toBe(first.cacheKey);
});

// Mutation caught: keying only on the quote id would serve a stale export after the quote text changes, whether from a locale switch or a reworded quote.
test('changes the cache key when the rendered text changes under the same identity', () => {
  const base: Quote = { ...quoteOfLength(80), text: 'A'.repeat(80) };
  const reworded: Quote = { ...base, text: 'B'.repeat(80) };

  const first = createComposition(
    { quote: base, preset, width: 1080, height: 2400 },
    measuredByCharacters,
  );
  const second = createComposition(
    { quote: reworded, preset, width: 1080, height: 2400 },
    measuredByCharacters,
  );

  expect(second.cacheKey).not.toBe(first.cacheKey);
});

// Mutation caught: a hash with unsafe characters would break the export filename built from the cache key.
test('keeps the cache key safe for use as a filename', () => {
  const composition = createComposition(
    {
      quote: {
        ...quoteOfLength(40),
        text: 'Quotes: "with" punctuation / slashes',
      },
      preset,
      width: 1080,
      height: 2400,
    },
    measuredByCharacters,
  );

  expect(composition.cacheKey).toMatch(/^[A-Za-z0-9._-]+$/);
});
