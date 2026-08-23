import { fitText, type TextMeasurer } from '../textFit';

const lineMeasurer: TextMeasurer = {
  measure: (_text, _width, _fontSize, lineHeight) => ({
    height: lineHeight * 2,
    lineCount: 2,
  }),
};

// Mutation caught: accepting the preferred size without measuring would allow a quote to exceed its box.
test('keeps the preferred pixel size when the measured paragraph already fits', () => {
  const result = fitText({
    preferredSize: 72,
    minimumSize: 40,
    maxHeight: 200,
    lineHeight: 1.2,
    measure: lineMeasurer,
  });

  expect(result).toMatchObject({ fontSize: 72, truncated: false, maxLines: 2 });
  expect(result.measuredHeight).toBeCloseTo(172.8);
});

// Mutation caught: changing the decrement to a ratio or multi-pixel step would skip the first fitting logical pixel.
test('decrements one logical pixel at a time until a paragraph fits', () => {
  const measure: TextMeasurer = {
    measure: (_text, _width, fontSize, lineHeight) => ({
      height: fontSize > 68 ? lineHeight * 3 : lineHeight * 2,
      lineCount: fontSize > 68 ? 3 : 2,
    }),
  };

  expect(
    fitText({
      preferredSize: 72,
      minimumSize: 40,
      maxHeight: 170,
      lineHeight: 1.2,
      measure,
    }),
  ).toMatchObject({ fontSize: 68, measuredHeight: 163.2, truncated: false });
});

// Mutation caught: stopping before the inclusive minimum would reject a size that exactly fills the allowed height.
test('accepts an exact fit at the minimum size', () => {
  const measure: TextMeasurer = {
    measure: (_text, _width, fontSize, lineHeight) => ({
      height: fontSize === 40 ? lineHeight * 2 : 201,
      lineCount: 2,
    }),
  };

  expect(
    fitText({
      preferredSize: 42,
      minimumSize: 40,
      maxHeight: 96,
      lineHeight: 1.2,
      measure,
    }),
  ).toMatchObject({ fontSize: 40, measuredHeight: 96, truncated: false });
});

// Mutation caught: returning the overflowing measurement at minimum size would clip instead of constraining the paragraph.
test('uses controlled ellipsis at minimum size instead of clipping', () => {
  const alwaysTooTall: TextMeasurer = {
    measure: () => ({ height: 500, lineCount: 12 }),
  };

  const result = fitText({
    preferredSize: 72,
    minimumSize: 40,
    maxHeight: 200,
    lineHeight: 1.2,
    measure: alwaysTooTall,
  });

  expect(result).toMatchObject({
    fontSize: 40,
    measuredHeight: 200,
    truncated: true,
  });
  expect(result.maxLines).toBe(4);
});
