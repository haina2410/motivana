import quoteCatalog from '../../../assets/data/quotes.json';
import { parseQuoteCatalog, type Quote } from './types';

const quotes = parseQuoteCatalog(quoteCatalog);
const quotesById = new Map(quotes.map((quote) => [quote.id, quote]));

export interface RandomQuoteOptions {
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

export function getAllQuotes(): readonly Quote[] {
  return quotes;
}

export function getQuoteById(id: string): Quote | undefined {
  return quotesById.get(id);
}

export function getAdjacentQuote(
  id: string,
  direction: 'next' | 'previous',
): Quote | undefined {
  const currentIndex = quotes.findIndex((quote) => quote.id === id);
  if (currentIndex === -1) {
    return undefined;
  }

  const nextIndex =
    direction === 'next'
      ? (currentIndex + 1) % quotes.length
      : (currentIndex - 1 + quotes.length) % quotes.length;
  return quotes[nextIndex];
}

export function selectRandomQuote(options: RandomQuoteOptions = {}): Quote {
  const eligibleQuotes = quotes.filter(
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
