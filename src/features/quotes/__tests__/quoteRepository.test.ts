import {
  getAdjacentQuote,
  getAllQuotes,
  getQuoteById,
  QuoteSelectionError,
  selectRandomQuote,
} from '../quoteRepository';
import { quoteCategories, type Quote } from '../types';

test('ships 120 unique non-empty original quotes across every category', () => {
  const quotes = getAllQuotes();

  expect(quotes).toHaveLength(120);
  expect(new Set(quotes.map((quote) => quote.id)).size).toBe(120);
  expect(new Set(quotes.map((quote) => quote.category))).toEqual(
    new Set(quoteCategories),
  );
  expect(quotes.every((quote) => quote.text.trim().length >= 12)).toBe(true);
  expect(quotes.every((quote) => quote.author === undefined)).toBe(true);
  expect(
    quotes.filter((quote) => quote.text.length >= 200).length,
  ).toBeGreaterThanOrEqual(4);
});

test('returns a readonly catalog that cannot alter later reads', () => {
  const quotes = getAllQuotes() as Quote[];

  expect(() => quotes.pop()).toThrow();
  expect(getAllQuotes()).toHaveLength(120);
});

test('looks up a known quote and returns undefined for a missing ID', () => {
  expect(getQuoteById('motivation-001')).toMatchObject({
    id: 'motivation-001',
    category: 'motivation',
  });
  expect(getQuoteById('not-a-quote')).toBeUndefined();
});

test('navigates forward and backward with catalog wraparound', () => {
  expect(getAdjacentQuote('motivation-001', 'previous')?.id).toBe(
    'success-020',
  );
  expect(getAdjacentQuote('success-020', 'next')?.id).toBe('motivation-001');
  expect(getAdjacentQuote('not-a-quote', 'next')).toBeUndefined();
});

test('selects only from eligible IDs using an injected random value', () => {
  const quote = selectRandomQuote({
    eligibleIds: new Set(['focus-001', 'focus-002']),
    random: () => 0.75,
  });

  expect(quote.id).toBe('focus-002');
});

test('never immediately repeats a previous eligible quote when another exists', () => {
  const quote = selectRandomQuote({
    eligibleIds: new Set(['success-001', 'success-002']),
    previousId: 'success-001',
    random: () => 0,
  });

  expect(quote.id).toBe('success-002');
});

test('clamps injected random values to the available range', () => {
  expect(selectRandomQuote({ random: () => -3 }).id).toBe('motivation-001');
  expect(selectRandomQuote({ random: () => 3 }).id).toBe('success-020');
});

test('rejects an empty eligible set with a selection error code', () => {
  expect(() => selectRandomQuote({ eligibleIds: new Set() })).toThrow(
    QuoteSelectionError,
  );
  expect(() => selectRandomQuote({ eligibleIds: new Set() })).toThrow(
    'NO_ELIGIBLE_QUOTES',
  );
});
