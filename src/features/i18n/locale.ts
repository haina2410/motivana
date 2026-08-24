export const locales = ['en', 'vi'] as const;

export type Locale = (typeof locales)[number];

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (locales as readonly string[]).includes(value)
  );
}

/**
 * Reads the language subtag of each tag in order, and returns the first
 * supported locale. Falls back to English.
 */
export function resolveDeviceLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const language = tag.split('-')[0]?.toLowerCase();
    if (isLocale(language)) {
      return language;
    }
  }
  return 'en';
}
