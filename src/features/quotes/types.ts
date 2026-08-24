import { isLocale, type Locale } from '../i18n/locale';

export const quoteCategories = [
  'motivation',
  'discipline',
  'focus',
  'confidence',
  'growth',
  'success',
] as const;

export type QuoteCategory = (typeof quoteCategories)[number];

export const QUOTE_TEXT_MINIMUM = 12;
export const QUOTE_TEXT_MAXIMUM = 160;

export interface Quote {
  id: string;
  category: QuoteCategory;
  sourceLocale: Locale;
  text: Partial<Record<Locale, string>>;
  author?: string;
}

/** Returns the text for one locale, with no fallback to another language. */
export function quoteText(quote: Quote, locale: Locale): string | undefined {
  return quote.text[locale];
}

export class QuoteCatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteCatalogValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseText(
  value: unknown,
  path: string,
): Partial<Record<Locale, string>> {
  if (!isRecord(value)) {
    throw new QuoteCatalogValidationError(`${path} must be an object`);
  }
  const text: Partial<Record<Locale, string>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isLocale(key)) {
      throw new QuoteCatalogValidationError(
        `${path}.${key} is not a supported locale`,
      );
    }
    if (
      typeof entry !== 'string' ||
      entry.trim().length < QUOTE_TEXT_MINIMUM ||
      entry.length > QUOTE_TEXT_MAXIMUM
    ) {
      throw new QuoteCatalogValidationError(
        `${path}.${key} must contain ${QUOTE_TEXT_MINIMUM} to ${QUOTE_TEXT_MAXIMUM} characters`,
      );
    }
    text[key] = entry;
  }
  return text;
}

export function parseQuoteCatalog(value: unknown): readonly Quote[] {
  if (!Array.isArray(value)) {
    throw new QuoteCatalogValidationError('quotes must be an array');
  }

  const ids = new Set<string>();
  const quotes = value.map((entry, index): Quote => {
    const path = `quotes[${index}]`;
    if (!isRecord(entry)) {
      throw new QuoteCatalogValidationError(`${path} must be an object`);
    }
    if (typeof entry.id !== 'string' || entry.id.trim() === '') {
      throw new QuoteCatalogValidationError(
        `${path}.id must be a non-empty string`,
      );
    }
    if (ids.has(entry.id)) {
      throw new QuoteCatalogValidationError(`${path}.id must be unique`);
    }
    ids.add(entry.id);
    if (
      entry.author !== undefined &&
      (typeof entry.author !== 'string' || entry.author.trim() === '')
    ) {
      throw new QuoteCatalogValidationError(
        `${path}.author must be a non-empty string`,
      );
    }
    if (
      typeof entry.category !== 'string' ||
      !quoteCategories.includes(entry.category as QuoteCategory)
    ) {
      throw new QuoteCatalogValidationError(
        `${path}.category is not supported`,
      );
    }
    if (!isLocale(entry.sourceLocale)) {
      throw new QuoteCatalogValidationError(
        `${path}.sourceLocale is not supported`,
      );
    }
    const text = parseText(entry.text, `${path}.text`);
    if (text[entry.sourceLocale] === undefined) {
      throw new QuoteCatalogValidationError(
        `${path}.text.${entry.sourceLocale} is required for the source locale`,
      );
    }

    return Object.freeze({
      id: entry.id,
      category: entry.category as QuoteCategory,
      sourceLocale: entry.sourceLocale,
      text: Object.freeze(text),
      author: entry.author,
    });
  });

  return Object.freeze(quotes);
}
