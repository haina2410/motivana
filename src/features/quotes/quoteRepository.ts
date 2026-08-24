import quoteCatalog from '../../../assets/data/quotes.json';
import { parseQuoteCatalog, quoteText, type Quote } from './types';
import type { Locale } from '../i18n/locale';

const quotes = parseQuoteCatalog(quoteCatalog);
const quotesById = new Map(quotes.map((quote) => [quote.id, quote]));

export interface RandomQuoteOptions {
  locale: Locale;
  eligibleIds?: ReadonlySet<string>;
  previousId?: string;
  random?: () => number;
}

export class QuoteSelectionError extends Error {
  readonly code = 'NO_ELIGIBLE_QUOTES';

  constructor() {
    super('NO_ELIGIBLE_QUOTES');
    this.name = 'QuoteSelectionError';
  }
}

export function getAllQuotes(locale?: Locale): readonly Quote[] {
  if (locale === undefined) {
    return quotes;
  }
  return Object.freeze(
    quotes.filter((quote) => quoteText(quote, locale) !== undefined),
  );
}

/** Not filtered by locale, because a favorite can hold any language. */
export function getQuoteById(id: string): Quote | undefined {
  return quotesById.get(id);
}

/**
 * Shows the text the reader chose, and falls back to the original language.
 * Only favorites use this, because the user selected the quote on purpose.
 */
export function favoriteQuoteText(quote: Quote, locale: Locale): string {
  return quoteText(quote, locale) ?? quote.text[quote.sourceLocale]!;
}

/** True when the quote exists and carries text in that language. */
export function quoteInLocale(id: string, locale: Locale): boolean {
  const quote = quotesById.get(id);
  return quote !== undefined && quoteText(quote, locale) !== undefined;
}

export function getAdjacentQuote(
  id: string,
  direction: 'next' | 'previous',
  locale: Locale,
): Quote | undefined {
  const pool = getAllQuotes(locale);
  if (pool.length === 0) {
    return undefined;
  }
  const currentIndex = pool.findIndex((quote) => quote.id === id);
  if (currentIndex === -1) {
    return pool[0];
  }
  const nextIndex =
    direction === 'next'
      ? (currentIndex + 1) % pool.length
      : (currentIndex - 1 + pool.length) % pool.length;
  return pool[nextIndex];
}

export function selectRandomQuote(options: RandomQuoteOptions): Quote {
  const eligibleQuotes = getAllQuotes(options.locale).filter(
    (quote) => !options.eligibleIds || options.eligibleIds.has(quote.id),
  );
  if (eligibleQuotes.length === 0) {
    throw new QuoteSelectionError();
  }

  const candidates =
    options.previousId && eligibleQuotes.length > 1
      ? eligibleQuotes.filter((quote) => quote.id !== options.previousId)
      : eligibleQuotes;
  const random = options.random ?? Math.random;
  const index = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(random() * candidates.length)),
  );

  return candidates[index]!;
}
