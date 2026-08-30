import {
  favoriteQuoteText,
  getAdjacentQuote,
  getAllQuotes,
  getQuoteById,
  quoteInLocale,
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
// The catalogue has no fixed size, so this holds the same floor as the data gate.
test('ships unique quotes across every category', () => {
  const quotes = getAllQuotes();

  expect(quotes.length).toBeGreaterThanOrEqual(36);
  expect(new Set(quotes.map((quote) => quote.id)).size).toBe(quotes.length);
  expect(new Set(quotes.map((quote) => quote.category))).toEqual(
    new Set(quoteCategories),
  );
  for (const category of quoteCategories) {
    expect(
      quotes.filter((quote) => quote.category === category).length,
    ).toBeGreaterThanOrEqual(3);
  }
  // Every quote must read in the language it was written in. A second locale is
  // optional, so a Vietnamese-only quote is a complete entry, not a gap.
  expect(
    quotes.every(
      (quote) => (quote.text[quote.sourceLocale] ?? '').trim().length >= 12,
    ),
  ).toBe(true);
  // Sourced quotes carry the person who said them; original app copy carries none.
  expect(
    quotes.every(
      (quote) => quote.author === undefined || quote.author.trim().length > 0,
    ),
  ).toBe(true);
});

// Mutation caught: allowing text past the cap would render a 9-line paragraph instead of a quote.
test('rejects text longer than the cap', () => {
  expect(() =>
    parseQuoteCatalog([{ ...validEntry, text: { en: 'A'.repeat(161) } }]),
  ).toThrow(/text.en/);
  expect(() =>
    parseQuoteCatalog([{ ...validEntry, text: { en: 'A'.repeat(160) } }]),
  ).not.toThrow();
});

// Mutation caught: a single long quote in the catalog would break the wallpaper layout the cap protects.
test('keeps every catalog quote inside the cap', () => {
  for (const quote of getAllQuotes()) {
    for (const [locale, text] of Object.entries(quote.text)) {
      expect(text.length).toBeLessThanOrEqual(160);
      expect(locale).toMatch(/^(en|vi)$/);
    }
  }
});

test('returns a readonly catalog that cannot alter later reads', () => {
  const quotes = getAllQuotes() as Quote[];

  expect(() => quotes.pop()).toThrow();
  expect(getAllQuotes()).toHaveLength(quotes.length);
});

test('looks up a known quote and returns undefined for a missing ID', () => {
  expect(getQuoteById('motivation-001')).toMatchObject({
    id: 'motivation-001',
    category: 'motivation',
  });
  expect(getQuoteById('not-a-quote')).toBeUndefined();
});

// The ends are read from the catalogue: every harvest renumbers the last ID.
test('navigates forward and backward with catalog wraparound', () => {
  const english = getAllQuotes('en');
  const first = english.at(0)!.id;
  const last = english.at(-1)!.id;

  expect(getAdjacentQuote(first, 'previous', 'en')?.id).toBe(last);
  expect(getAdjacentQuote(last, 'next', 'en')?.id).toBe(first);
  expect(getAdjacentQuote('not-a-quote', 'next', 'en')?.id).toBe(first);
});

test('selects only from eligible IDs using an injected random value', () => {
  const quote = selectRandomQuote({
    locale: 'en',
    eligibleIds: new Set(['focus-001', 'focus-002']),
    random: () => 0.75,
  });

  expect(quote.id).toBe('focus-002');
});

test('never immediately repeats a previous eligible quote when another exists', () => {
  const quote = selectRandomQuote({
    locale: 'en',
    eligibleIds: new Set(['success-001', 'success-002']),
    previousId: 'success-001',
    random: () => 0,
  });

  expect(quote.id).toBe('success-002');
});

test('clamps injected random values to the available range', () => {
  const english = getAllQuotes('en');

  expect(selectRandomQuote({ locale: 'en', random: () => -3 }).id).toBe(
    english.at(0)!.id,
  );
  expect(selectRandomQuote({ locale: 'en', random: () => 3 }).id).toBe(
    english.at(-1)!.id,
  );
});

test('rejects an empty eligible set with a selection error code', () => {
  expect(() =>
    selectRandomQuote({ locale: 'en', eligibleIds: new Set() }),
  ).toThrow(QuoteSelectionError);
  expect(() =>
    selectRandomQuote({ locale: 'en', eligibleIds: new Set() }),
  ).toThrow('NO_ELIGIBLE_QUOTES');
});

// Mutation caught: leaving untranslated quotes in the pool would show English text to a Vietnamese reader.
test('offers only quotes that have text for the requested locale', () => {
  const all = getAllQuotes();
  const english = getAllQuotes('en');
  const vietnamese = getAllQuotes('vi');

  expect(english.every((quote) => quote.text.en !== undefined)).toBe(true);
  expect(vietnamese.every((quote) => quote.text.vi !== undefined)).toBe(true);
  // Neither language covers the whole catalogue, so each pool holds exactly the
  // quotes that carry it. A filter that ignored the locale would fail both.
  expect(english.length).toBe(
    all.filter((quote) => quote.text.en !== undefined).length,
  );
  expect(vietnamese.length).toBe(
    all.filter((quote) => quote.text.vi !== undefined).length,
  );
});

// Mutation caught: stepping through the unfiltered catalog would land on a quote with no text in the active language.
test('steps only through quotes available in the locale', () => {
  const vietnamese = getAllQuotes('vi');
  const first = vietnamese[0]!;
  const next = getAdjacentQuote(first.id, 'next', 'vi');

  expect(next?.text.vi).toBeDefined();
});

// Mutation caught: ignoring the locale in random selection would apply an untranslated wallpaper during rotation.
test('selects a random quote only from the locale pool', () => {
  const quote = selectRandomQuote({ locale: 'vi', random: () => 0 });

  expect(quote.text.vi).toBeDefined();
});

// Mutation caught: shipping only translations would leave the original-Vietnamese path untested.
test('includes an original Vietnamese quote in every category', () => {
  const original = getAllQuotes('vi').filter(
    (quote) => quote.sourceLocale === 'vi',
  );

  expect(new Set(original.map((quote) => quote.category)).size).toBe(
    quoteCategories.length,
  );
});

// Mutation caught: raising an error for an empty locale pool at the wrong point would crash rotation instead of reporting it.
test('reports no eligible quotes when the locale pool is empty', () => {
  expect(() =>
    selectRandomQuote({ locale: 'vi', eligibleIds: new Set(['missing-id']) }),
  ).toThrow(QuoteSelectionError);
});

// Mutation caught: applying the pool rule to favorites would hide a favorite the user deliberately saved.
test('falls back to the source language for a favorite', () => {
  const englishOnly = getAllQuotes().find(
    (quote) => quote.text.vi === undefined,
  )!;

  expect(favoriteQuoteText(englishOnly, 'vi')).toBe(englishOnly.text.en);
  expect(favoriteQuoteText(englishOnly, 'en')).toBe(englishOnly.text.en);
});

// Mutation caught: reading text["all"] would render undefined on the wallpaper for every quote.
test('renders the source language when the reader chose every language', () => {
  const [quote] = parseQuoteCatalog([
    {
      ...validEntry,
      sourceLocale: 'vi',
      text: { vi: 'Bắt đầu ngay hôm nay.' },
    },
  ]);

  expect(quoteText(quote!, 'all')).toBe('Bắt đầu ngay hôm nay.');
});

// Mutation caught: filtering on a text key named "all" would empty the pool and break rotation.
test('draws from the whole catalog when the reader chose every language', () => {
  const every = getAllQuotes('all');

  expect(every.length).toBe(getAllQuotes().length);
  expect(quoteInLocale(every.at(-1)!.id, 'all')).toBe(true);
  expect(selectRandomQuote({ locale: 'all', random: () => 0 }).id).toBe(
    every.at(0)!.id,
  );
});
