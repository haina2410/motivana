import {
  getAdjacentQuote,
  getAllQuotes,
  getQuoteById,
  QuoteSelectionError,
  selectRandomQuote,
} from '../quoteRepository';
import {
  parseQuoteCatalog,
  quoteCategories,
  quoteText,
  type Quote,
} from '../types';

const validEntry = {
  id: 'motivation-001',
  category: 'motivation',
  sourceLocale: 'en',
  text: { en: 'Begin before your mood negotiates the day away.' },
};

// Mutation caught: accepting a missing source text would let a quote render as undefined on the wallpaper.
test('requires text for the source locale', () => {
  expect(() =>
    parseQuoteCatalog([
      { ...validEntry, text: { vi: 'Bắt đầu ngay hôm nay.' } },
    ]),
  ).toThrow(/text.en/);
});

// Mutation caught: accepting an unknown locale key would silently drop translations that never render.
test('rejects an unsupported locale key and an unsupported source locale', () => {
  expect(() =>
    parseQuoteCatalog([
      { ...validEntry, text: { ...validEntry.text, fr: 'Commencez.' } },
    ]),
  ).toThrow(/text.fr/);
  expect(() =>
    parseQuoteCatalog([{ ...validEntry, sourceLocale: 'fr' }]),
  ).toThrow(/sourceLocale/);
});

// Mutation caught: returning the source text for every locale would show English inside the Vietnamese pool.
test('returns text only for the locale that has it', () => {
  const [quote] = parseQuoteCatalog([validEntry]);

  expect(quoteText(quote!, 'en')).toBe(validEntry.text.en);
  expect(quoteText(quote!, 'vi')).toBeUndefined();
});

// Mutation caught: losing a category or an id would shrink the pool without any failing assertion.
test('ships 120 unique English quotes across every category', () => {
  const quotes = getAllQuotes();

  expect(quotes).toHaveLength(120);
  expect(new Set(quotes.map((quote) => quote.id)).size).toBe(120);
  expect(new Set(quotes.map((quote) => quote.category))).toEqual(
    new Set(quoteCategories),
  );
  expect(quotes.every((quote) => quote.sourceLocale === 'en')).toBe(true);
  expect(
    quotes.every((quote) => (quote.text.en ?? '').trim().length >= 12),
  ).toBe(true);
  expect(quotes.every((quote) => quote.author === undefined)).toBe(true);
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
