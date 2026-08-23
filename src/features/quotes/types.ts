export const quoteCategories = [
  'motivation',
  'discipline',
  'focus',
  'confidence',
  'growth',
  'success',
] as const;

export type QuoteCategory = (typeof quoteCategories)[number];

export interface Quote {
  id: string;
  text: string;
  author?: string;
  category: QuoteCategory;
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
    if (typeof entry.text !== 'string' || entry.text.trim().length < 12) {
      throw new QuoteCatalogValidationError(
        `${path}.text must contain at least 12 non-whitespace characters`,
      );
    }
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

    return Object.freeze({
      id: entry.id,
      text: entry.text,
      author: entry.author,
      category: entry.category as QuoteCategory,
    });
  });

  return Object.freeze(quotes);
}
