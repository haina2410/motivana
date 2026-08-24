# Quote and App Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motivana shows quotes and interface text in English or Vietnamese, with the interface language and the quote language chosen separately.

**Architecture:** One quote entity holds text for each locale and records the language it was written in, so quote ids stay stable across languages. The interface uses a typed string catalog and a `t()` helper, with no i18n library. Two independent locales live in the persisted state: `appLocale` for the interface and `contentLocale` for the quote pool.

**Tech Stack:** TypeScript, React Native 0.86 with Expo 57, expo-router, Zustand, react-native-mmkv, Skia renderer, Jest with jest-expo.

**Spec:** `docs/superpowers/specs/2026-08-24-quote-localization-design.md`

## Global Constraints

- Locales are exactly `en` and `vi`. `export const locales = ['en', 'vi'] as const`.
- Quote text: minimum 12 non-whitespace characters, maximum 160 characters, for each locale.
- The quote pool never falls back to the other language. Favorites are the only exception.
- Quote ids never change. Never remove a quote id that a favorite can hold.
- No third-party i18n library. `expo-localization` is the only new dependency.
- Every task ends with `pnpm verify` green (`format:check`, `lint`, `typecheck`, `verify:data`, `verify:android-permissions`, `test`).
- Tests carry a `// Mutation caught: ...` comment above them, matching the existing convention in `src/features/wallpaper/__tests__/composition.test.ts`.
- Commit messages are one line, imperative, lowercase after the type prefix.
- Vietnamese first batch: 5 quotes per category (30 total), with at least 1 original Vietnamese quote (`sourceLocale: 'vi'`) in each category.

## Already Done

These spec items are already on the branch. Do not redo them.

- `5a79112` — the wallpaper cache key includes an FNV-1a fingerprint of the rendered text, so it does not need the locale.
- `fe3cb9e` — `scripts/verify-data.mjs` treats `author` as optional, and the four-stress-case rule is removed.

---

### Task 1: Locale type and device locale

**Files:**
- Create: `src/features/i18n/locale.ts`
- Create: `src/features/i18n/__tests__/locale.test.ts`
- Modify: `package.json` (add `expo-localization`)

**Interfaces:**
- Consumes: nothing.
- Produces: `locales: readonly ['en', 'vi']`, `type Locale = 'en' | 'vi'`, `isLocale(value: unknown): value is Locale`, `resolveDeviceLocale(tags: readonly string[]): Locale`.

- [ ] **Step 1: Add the dependency**

```bash
pnpm add expo-localization
```

- [ ] **Step 2: Write the failing test**

Create `src/features/i18n/__tests__/locale.test.ts`:

```ts
import { isLocale, locales, resolveDeviceLocale } from '../locale';

// Mutation caught: accepting an unknown tag would let an unsupported locale reach the string catalog and render undefined text.
test('accepts only the supported locales', () => {
  expect(locales).toEqual(['en', 'vi']);
  expect(isLocale('en')).toBe(true);
  expect(isLocale('vi')).toBe(true);
  expect(isLocale('fr')).toBe(false);
  expect(isLocale(undefined)).toBe(false);
});

// Mutation caught: comparing the whole tag instead of the language subtag would send a vi-VN device to English.
test('resolves the device language from the first supported tag', () => {
  expect(resolveDeviceLocale(['vi-VN', 'en-US'])).toBe('vi');
  expect(resolveDeviceLocale(['en-GB'])).toBe('en');
  expect(resolveDeviceLocale(['VI'])).toBe('vi');
});

// Mutation caught: returning undefined for an unsupported device language would leave the app with no locale at first launch.
test('falls back to English when no tag is supported', () => {
  expect(resolveDeviceLocale(['fr-FR', 'de-DE'])).toBe('en');
  expect(resolveDeviceLocale([])).toBe('en');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm jest src/features/i18n/__tests__/locale.test.ts`
Expected: FAIL, cannot find module `../locale`.

- [ ] **Step 4: Write the implementation**

Create `src/features/i18n/locale.ts`:

```ts
export const locales = ['en', 'vi'] as const;

export type Locale = (typeof locales)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm jest src/features/i18n/__tests__/locale.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the full check and commit**

```bash
pnpm verify
git add package.json pnpm-lock.yaml src/features/i18n
git commit -m "feat: add locale type and device locale resolver"
```

---

### Task 2: Quote text per locale

Changes the quote shape from `text: string` to `text: Partial<Record<Locale, string>>` and adds `sourceLocale`. This task keeps the current wording; Task 3 applies the length cap.

**Files:**
- Modify: `src/features/quotes/types.ts`
- Modify: `assets/data/quotes.json` (shape only, by script)
- Modify: `assets/data/renderer-golden-fixture.json` (the `cases[].quote` objects)
- Modify: `scripts/verify-data.mjs:89-128`
- Modify: `src/features/quotes/__tests__/quoteRepository.test.ts:10-23`
- Modify: `src/features/wallpaper/composition.ts:74,103`
- Modify: `src/features/wallpaper/scene.ts:196`
- Modify: `src/components/QuoteListItem.tsx:17,23`
- Modify: `app/automation.tsx:199`
- Modify: `src/features/wallpaper/__tests__/composition.test.ts:15-21`
- Modify: `src/features/wallpaper/__tests__/exportWallpaper.test.ts`
- Modify: `src/components/__tests__/WallpaperActions.test.tsx`

**Interfaces:**
- Consumes: `Locale`, `isLocale` from Task 1.
- Produces: `interface Quote { id, category, sourceLocale: Locale, text: Partial<Record<Locale, string>>, author?: string }`, and `quoteText(quote: Quote, locale: Locale): string | undefined`.

- [ ] **Step 1: Write the failing test for the parser**

Add to `src/features/quotes/__tests__/quoteRepository.test.ts`:

```ts
import { parseQuoteCatalog, quoteText } from '../types';

const validEntry = {
  id: 'motivation-001',
  category: 'motivation',
  sourceLocale: 'en',
  text: { en: 'Begin before your mood negotiates the day away.' },
};

// Mutation caught: accepting a missing source text would let a quote render as undefined on the wallpaper.
test('requires text for the source locale', () => {
  expect(() =>
    parseQuoteCatalog([{ ...validEntry, text: { vi: 'Bắt đầu ngay hôm nay.' } }]),
  ).toThrow(/text.en/);
});

// Mutation caught: accepting an unknown locale key would silently drop translations that never render.
test('rejects an unsupported locale key and an unsupported source locale', () => {
  expect(() =>
    parseQuoteCatalog([{ ...validEntry, text: { ...validEntry.text, fr: 'Commencez.' } }]),
  ).toThrow(/text.fr/);
  expect(() => parseQuoteCatalog([{ ...validEntry, sourceLocale: 'fr' }])).toThrow(
    /sourceLocale/,
  );
});

// Mutation caught: returning the source text for every locale would show English inside the Vietnamese pool.
test('returns text only for the locale that has it', () => {
  const [quote] = parseQuoteCatalog([validEntry]);

  expect(quoteText(quote!, 'en')).toBe(validEntry.text.en);
  expect(quoteText(quote!, 'vi')).toBeUndefined();
});
```

Replace the existing catalog test at lines 10-23 with:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/features/quotes`
Expected: FAIL, `quoteText` is not exported and the parser accepts the old shape.

- [ ] **Step 3: Rewrite the parser**

Replace the `Quote` interface and `parseQuoteCatalog` in `src/features/quotes/types.ts`:

```ts
import { isLocale, locales, type Locale } from '../i18n/locale';

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

function parseText(value: unknown, path: string): Partial<Record<Locale, string>> {
  if (!isRecord(value)) {
    throw new QuoteCatalogValidationError(`${path} must be an object`);
  }
  const text: Partial<Record<Locale, string>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isLocale(key)) {
      throw new QuoteCatalogValidationError(`${path}.${key} is not a supported locale`);
    }
    if (typeof entry !== 'string' || entry.trim().length < QUOTE_TEXT_MINIMUM) {
      throw new QuoteCatalogValidationError(
        `${path}.${key} must contain at least ${QUOTE_TEXT_MINIMUM} non-whitespace characters`,
      );
    }
    text[key] = entry;
  }
  return text;
}
```

Inside the `value.map` callback, replace the old `text` check with:

```ts
    if (!isLocale(entry.sourceLocale)) {
      throw new QuoteCatalogValidationError(`${path}.sourceLocale is not supported`);
    }
    const text = parseText(entry.text, `${path}.text`);
    if (text[entry.sourceLocale] === undefined) {
      throw new QuoteCatalogValidationError(
        `${path}.text.${entry.sourceLocale} is required for the source locale`,
      );
    }
```

and return:

```ts
    return Object.freeze({
      id: entry.id,
      category: entry.category as QuoteCategory,
      sourceLocale: entry.sourceLocale,
      text: Object.freeze(text),
      author: entry.author,
    });
```

Keep `locales` imported for the length rules in Task 3.

- [ ] **Step 4: Migrate the data files**

Run this script once, then delete it:

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const quotesPath = 'assets/data/quotes.json';
const quotes = JSON.parse(readFileSync(quotesPath, 'utf8')).map((quote) => ({
  id: quote.id,
  category: quote.category,
  sourceLocale: 'en',
  text: { en: quote.text },
}));
writeFileSync(quotesPath, JSON.stringify(quotes, null, 2) + '\n');

const fixturePath = 'assets/data/renderer-golden-fixture.json';
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
fixture.cases = fixture.cases.map((entry) => ({
  ...entry,
  quote: {
    id: entry.quote.id,
    category: entry.quote.category,
    sourceLocale: 'en',
    text: { en: entry.quote.text },
    ...(entry.quote.author === undefined ? {} : { author: entry.quote.author }),
  },
}));
writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
"
```

- [ ] **Step 5: Update the verifier**

In `scripts/verify-data.mjs`, replace the `quote.text` check inside `validateQuotes` with:

```js
    if (!['en', 'vi'].includes(quote.sourceLocale)) {
      fail(`${path}.sourceLocale`, 'must be en or vi');
    }
    if (!isRecord(quote.text)) {
      fail(`${path}.text`, 'must be an object keyed by locale');
    }
    for (const [locale, text] of Object.entries(quote.text)) {
      if (!['en', 'vi'].includes(locale)) {
        fail(`${path}.text.${locale}`, 'is not a supported locale');
      }
      if (typeof text !== 'string' || text.trim().length < 12) {
        fail(`${path}.text.${locale}`, 'must contain at least 12 non-whitespace characters');
      }
    }
    if (quote.text[quote.sourceLocale] === undefined) {
      fail(`${path}.text.${quote.sourceLocale}`, 'is required for the source locale');
    }
```

- [ ] **Step 6: Update the readers to use `quoteText`**

Each site reads English for now, so pass `'en'` explicitly. Task 4 replaces `'en'` with the active locale.

- `src/features/wallpaper/composition.ts:74` — `text: quoteText(input.quote, 'en') ?? ''`
- `src/features/wallpaper/composition.ts:103` — the fingerprint argument becomes `quoteText(input.quote, 'en') ?? ''`
- `src/features/wallpaper/scene.ts:196` — `quoteText(composition.quote, 'en') ?? ''`
- `src/components/QuoteListItem.tsx:17,23` — `quoteText(quote, 'en') ?? ''`
- `app/automation.tsx:199` — `quoteText(lastQuote, 'en') ?? 'saved quote'` when `lastQuote` is defined

In the test helpers, change the fixture builders to the new shape. In `src/features/wallpaper/__tests__/composition.test.ts:15-21`:

```ts
function quoteOfLength(length: number): Quote {
  return {
    id: `quote-${length}`,
    category: 'motivation',
    sourceLocale: 'en',
    text: { en: 'A'.repeat(length) },
    author: 'Author',
  };
}
```

Apply the same shape to the inline quote fixtures in `exportWallpaper.test.ts` and `WallpaperActions.test.tsx`. In `composition.test.ts`, the two tests that pass a literal `text` string (the cache key tests added in `5a79112`) become `text: { en: 'A'.repeat(80) }` and `text: { en: 'B'.repeat(80) }`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, all suites.

- [ ] **Step 8: Run the full check and commit**

```bash
pnpm verify
git add -A
git commit -m "feat: hold quote text per locale"
```

---

### Task 3: Enforce the 160-character cap

**Files:**
- Modify: `src/features/quotes/types.ts` (add the maximum to `parseText`)
- Modify: `scripts/verify-data.mjs`
- Modify: `assets/data/quotes.json` (rewrite six quotes)
- Modify: `src/features/quotes/__tests__/quoteRepository.test.ts`

**Interfaces:**
- Consumes: `QUOTE_TEXT_MAXIMUM` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Add to `src/features/quotes/__tests__/quoteRepository.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/features/quotes`
Expected: FAIL, the six long quotes exceed 160 and the parser accepts 161.

- [ ] **Step 3: Add the cap to the parser**

In `parseText` in `src/features/quotes/types.ts`, extend the length check:

```ts
    if (
      typeof entry !== 'string' ||
      entry.trim().length < QUOTE_TEXT_MINIMUM ||
      entry.length > QUOTE_TEXT_MAXIMUM
    ) {
      throw new QuoteCatalogValidationError(
        `${path}.${key} must contain ${QUOTE_TEXT_MINIMUM} to ${QUOTE_TEXT_MAXIMUM} characters`,
      );
    }
```

Add the same bound to `scripts/verify-data.mjs`:

```js
      if (typeof text !== 'string' || text.trim().length < 12 || text.length > 160) {
        fail(`${path}.text.${locale}`, 'must contain 12 to 160 characters');
      }
```

- [ ] **Step 4: Rewrite the six long quotes**

Shorten `text.en` for `motivation-020`, `discipline-020`, `focus-020`, `confidence-020`, `growth-020`, and `success-020` to 160 characters or fewer. Keep each id and category. Keep the original idea, and cut the trailing clauses that repeat it. Use these:

- `motivation-020`: `Each time you choose effort over avoidance, you teach your future self that progress is available.`
- `discipline-020`: `The strongest routine is not the one that looks impressive from outside; it is the one you still keep on a tired day.`
- `focus-020`: `Attention is the only currency that buys depth. Spend it on one thing long enough to see past the surface.`
- `confidence-020`: `Confidence is the memory of having survived the last hard thing. Collect those memories on purpose.`
- `growth-020`: `Growth asks you to trade the comfort of already knowing for the richer discomfort of discovering.`
- `success-020`: `Success is more durable when it includes the way you arrived: the habits you kept and the people you did not spend.`

Confirm each is 160 or fewer:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
for (const quote of JSON.parse(readFileSync('assets/data/quotes.json','utf8'))) {
  for (const [locale, text] of Object.entries(quote.text)) {
    if (text.length > 160) console.log('OVER', quote.id, locale, text.length);
  }
}
console.log('checked');
"
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS. `composition.test.ts` still covers 150 and 250 characters with synthetic text, so renderer stress coverage does not change.

- [ ] **Step 6: Run the full check and commit**

```bash
pnpm verify
git add -A
git commit -m "feat: cap quote text at 160 characters"
```

---

### Task 4: Locale-aware quote repository

**Files:**
- Modify: `src/features/quotes/quoteRepository.ts`
- Modify: `src/features/quotes/__tests__/quoteRepository.test.ts`

**Interfaces:**
- Consumes: `Locale`, `quoteText`, `Quote`.
- Produces:
  - `getAllQuotes(locale?: Locale): readonly Quote[]` — every quote when `locale` is absent, otherwise only quotes with text for it.
  - `getQuoteById(id: string): Quote | undefined` — unchanged, no locale filter, because favorites hold any language.
  - `getAdjacentQuote(id: string, direction: 'next' | 'previous', locale: Locale): Quote | undefined`
  - `selectRandomQuote(options: { locale: Locale; eligibleIds?: ReadonlySet<string>; previousId?: string; random?: () => number }): Quote`
  - `favoriteQuoteText(quote: Quote, locale: Locale): string` — the favorites fallback.

- [ ] **Step 1: Write the failing test**

Add to `src/features/quotes/__tests__/quoteRepository.test.ts`:

```ts
// Mutation caught: leaving untranslated quotes in the pool would show English text to a Vietnamese reader.
test('offers only quotes that have text for the requested locale', () => {
  const english = getAllQuotes('en');
  const vietnamese = getAllQuotes('vi');

  expect(english.length).toBe(120);
  expect(vietnamese.every((quote) => quote.text.vi !== undefined)).toBe(true);
  expect(vietnamese.length).toBeLessThan(english.length);
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

// Mutation caught: raising an error for an empty locale pool at the wrong point would crash rotation instead of reporting it.
test('reports no eligible quotes when the locale pool is empty', () => {
  expect(() =>
    selectRandomQuote({ locale: 'vi', eligibleIds: new Set(['missing-id']) }),
  ).toThrow(QuoteSelectionError);
});

// Mutation caught: applying the pool rule to favorites would hide a favorite the user deliberately saved.
test('falls back to the source language for a favorite', () => {
  const englishOnly = getAllQuotes().find((quote) => quote.text.vi === undefined)!;

  expect(favoriteQuoteText(englishOnly, 'vi')).toBe(englishOnly.text.en);
  expect(favoriteQuoteText(englishOnly, 'en')).toBe(englishOnly.text.en);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/features/quotes`
Expected: FAIL, the functions do not take a locale and `favoriteQuoteText` does not exist.

- [ ] **Step 3: Write the implementation**

Rewrite `src/features/quotes/quoteRepository.ts`:

```ts
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
  return Object.freeze(quotes.filter((quote) => quoteText(quote, locale) !== undefined));
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
```

Note the behaviour change in `getAdjacentQuote`: when the current quote is not in the locale pool, it returns the first quote of that pool instead of `undefined`. This is what lets the Home arrows keep working right after the reader changes the quote language.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm jest src/features/quotes`
Expected: PASS. The Vietnamese assertions rely on Task 9 content; until then `getAllQuotes('vi')` is empty, so keep the two Vietnamese pool tests skipped with `test.skip` and a `// Enabled by Task 9.` comment, and unskip them in Task 9.

- [ ] **Step 5: Run the full check and commit**

```bash
pnpm verify
git add -A
git commit -m "feat: filter the quote pool by locale"
```

---

### Task 5: Persisted state version 2

**Files:**
- Modify: `src/store/schema.ts`
- Modify: `src/store/useAppStore.ts`
- Modify: `src/store/__tests__/schema.test.ts`
- Modify: `src/store/__tests__/useAppStore.test.ts`
- Modify: `src/services/rotation.ts` or the callers that build `RandomQuoteOptions` (find them with `grep -rn "selectRandomQuote" src app`)

**Interfaces:**
- Consumes: `Locale`, `isLocale`, `resolveDeviceLocale`, `getAllQuotes`, `getQuoteById`.
- Produces: `PersistedAppStateV2` with `version: 2`, `appLocale: Locale`, `contentLocale: Locale`; store actions `setAppLocale(locale: Locale): Promise<boolean>` and `setContentLocale(locale: Locale): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

Add to `src/store/__tests__/schema.test.ts`:

```ts
// Mutation caught: resetting on version 1 would erase every saved favorite when the reader updates the app.
test('migrates version 1 state and keeps every favorite', () => {
  const migrated = migratePersistedState({
    version: 1,
    favoriteQuoteIds: ['motivation-001', 'focus-002'],
    currentQuoteId: 'motivation-001',
    selectedPresetId: 'midnight-focus',
    randomizePreset: true,
    favoriteQuotesOnly: true,
    rotationEnabled: true,
    rotationIntervalHours: 12,
    wallpaperTarget: 'both',
  });

  expect(migrated.version).toBe(2);
  expect(migrated.favoriteQuoteIds).toEqual(['motivation-001', 'focus-002']);
  expect(migrated.randomizePreset).toBe(true);
  expect(migrated.rotationIntervalHours).toBe(12);
  expect(migrated.wallpaperTarget).toBe('both');
  expect(migrated.appLocale).toBe('en');
  expect(migrated.contentLocale).toBe('en');
});

// Mutation caught: sharing one locale field would tie the interface language to the quote language.
test('keeps the interface and quote languages independent', () => {
  const migrated = migratePersistedState({
    version: 2,
    appLocale: 'vi',
    contentLocale: 'en',
    favoriteQuoteIds: [],
    currentQuoteId: 'motivation-001',
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
  });

  expect(migrated.appLocale).toBe('vi');
  expect(migrated.contentLocale).toBe('en');
});

// Mutation caught: accepting an unsupported stored locale would render undefined interface strings.
test('replaces an unsupported stored locale with English', () => {
  const migrated = migratePersistedState({
    version: 2,
    appLocale: 'fr',
    contentLocale: 42,
    favoriteQuoteIds: [],
    currentQuoteId: 'motivation-001',
    selectedPresetId: 'midnight-focus',
    randomizePreset: false,
    favoriteQuotesOnly: false,
    rotationEnabled: false,
    rotationIntervalHours: 24,
    wallpaperTarget: 'home',
  });

  expect(migrated.appLocale).toBe('en');
  expect(migrated.contentLocale).toBe('en');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/store/__tests__/schema.test.ts`
Expected: FAIL, migration returns version 1 and has no locale fields.

- [ ] **Step 3: Write the implementation**

In `src/store/schema.ts`:

```ts
import { isLocale, resolveDeviceLocale, type Locale } from '../features/i18n/locale';
import { getLocales } from 'expo-localization';

export interface PersistedAppStateV2 {
  version: 2;
  appLocale: Locale;
  contentLocale: Locale;
  favoriteQuoteIds: string[];
  currentQuoteId: string;
  lastAppliedQuoteId?: string;
  selectedPresetId: string;
  randomizePreset: boolean;
  favoriteQuotesOnly: boolean;
  rotationEnabled: boolean;
  rotationIntervalHours: RotationIntervalHours;
  wallpaperTarget: WallpaperTarget;
}

export type PersistedAppState = PersistedAppStateV2;

function deviceLocale(): Locale {
  try {
    return resolveDeviceLocale(getLocales().map((entry) => entry.languageTag));
  } catch {
    return 'en';
  }
}
```

`createDefaultPersistedAppState` returns `version: 2` with `appLocale: deviceLocale()` and `contentLocale: deviceLocale()`.

`migratePersistedState` accepts version 1 and version 2. Read the locales with `isLocale(input.appLocale) ? input.appLocale : deviceLocale()`, the same for `contentLocale`, and always return `version: 2`. Keep every other field rule unchanged.

In `hydrateAppState`, raise the rejected version from `> 1` to `> 2`, and accept a stored `version` of 1 or 2.

Important: `validQuoteId` keeps using `getQuoteById`, which has no locale filter, so favorites in any language survive the migration.

- [ ] **Step 4: Add the store actions**

In `src/store/useAppStore.ts`, extend `AppState` with `setAppLocale` and `setContentLocale`, and implement them beside `setRandomizePreset`:

```ts
      setAppLocale: (locale) =>
        isLocale(locale)
          ? commitAutomation((state) => ({ ...state, appLocale: locale }))
          : Promise.resolve(false),
      setContentLocale: (locale) =>
        isLocale(locale)
          ? commitAutomation((state) => {
              const pool = getAllQuotes(locale);
              if (pool.length === 0) {
                return undefined;
              }
              const currentStaysValid = pool.some(
                (quote) => quote.id === state.currentQuoteId,
              );
              return {
                ...state,
                contentLocale: locale,
                currentQuoteId: currentStaysValid ? state.currentQuoteId : pool[0]!.id,
              };
            })
          : Promise.resolve(false),
```

Update `nextQuote`, `previousQuote`, and `randomQuote` to pass `get().contentLocale` to the repository functions.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, all suites.

- [ ] **Step 6: Run the full check and commit**

```bash
pnpm verify
git add -A
git commit -m "feat: store interface and quote languages separately"
```

---

### Task 6: Interface string catalog

Builds the English catalog and `t()`. No screen changes yet, so this task is safe to review on its own.

**Files:**
- Create: `src/features/i18n/strings/en.ts`
- Create: `src/features/i18n/t.ts`
- Create: `src/features/i18n/__tests__/t.test.ts`

**Interfaces:**
- Consumes: `Locale` from Task 1.
- Produces: `en` (the key/value record), `type StringKey = keyof typeof en`, `t(locale: Locale, key: StringKey, params?: Record<string, string | number>): string`.

- [ ] **Step 1: Write the failing test**

Create `src/features/i18n/__tests__/t.test.ts`:

```ts
import { en } from '../strings/en';
import { t } from '../t';

// Mutation caught: dropping the interpolation would show a literal placeholder on the rotation screen.
test('fills placeholders from the parameters', () => {
  expect(t('en', 'automation.interval.option', { hours: 12 })).toBe('Every 12 hours');
});

// Mutation caught: returning the key instead of the text would show identifiers in the interface.
test('returns the English text for a known key', () => {
  expect(t('en', 'home.title')).toBe('Motivana');
  expect(t('en', 'common.back.label')).toBe('Back to Home');
});

// Mutation caught: an empty or duplicated catalog entry would leave a blank control in the interface.
test('every English entry is non-empty', () => {
  for (const [key, value] of Object.entries(en)) {
    expect(value.trim().length, key).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/features/i18n/__tests__/t.test.ts`
Expected: FAIL, cannot find module `../strings/en`.

- [ ] **Step 3: Write the English catalog**

Create `src/features/i18n/strings/en.ts` with exactly these keys. Every value is copied verbatim from the current screens, so the English interface does not change.

```ts
export const en = {
  'common.back.label': 'Back to Home',
  'common.back.hint': 'Returns to the wallpaper preview.',

  'home.eyebrow': 'MAKE YOUR FOCUS VISIBLE',
  'home.title': 'Motivana',
  'home.loading': 'Preparing your wallpaper',
  'home.customize.label': 'Customize wallpaper',
  'home.customize.hint': 'Choose a wallpaper preset.',
  'home.favorites.label': 'Open favorites',
  'home.favorites.hint': 'Browse favorite quotes.',
  'home.automation.label': 'Open automation',
  'home.automation.hint': 'Review wallpaper rotation preferences.',
  'home.settings.label': 'Open settings',
  'home.settings.hint': 'Change application preferences.',
  'home.previous.label': 'Previous quote',
  'home.previous.hint': 'Shows the previous motivational quote.',
  'home.next.label': 'Next quote',
  'home.next.hint': 'Shows a random motivational quote.',
  'home.favorite.hint': 'Adds or removes the current quote from favorites.',
  'home.favorite.retry.label': 'Retry favorite update',
  'home.favorite.retry.hint': 'Retries updating the favorite used by wallpaper rotation.',
  'home.preview.title': 'Wallpaper preview',
  'home.preview.error': 'Preview could not render.',
  'home.preview.retry.label': 'Retry preview',
  'home.preview.retry.hint': 'Tries to render the current wallpaper again.',

  'customize.eyebrow': 'YOUR VISUAL RHYTHM',
  'customize.title': 'Customize',
  'customize.error': 'Could not update the preset used for rotation. Try again.',
  'customize.retry.label': 'Retry preset update',
  'customize.retry.hint': 'Retries updating the preset used by wallpaper rotation.',

  'favorites.eyebrow': 'KEEP WHAT LANDS',
  'favorites.title': 'Favorites',
  'favorites.empty.title': 'No favorites yet',
  'favorites.empty.message': 'Favorite a quote from Home to use it here.',
  'favorites.item.hint': 'Uses this favorite quote on the Home wallpaper.',

  'automation.eyebrow': 'AUTOMATION',
  'automation.title': 'Rotation',
  'automation.available.title': 'Wallpaper targets available',
  'automation.available.message':
    'Rotation runs at an approximate interval; Android may defer work to preserve battery.',
  'automation.attention.title': 'Rotation needs attention',
  'automation.enable.label': 'Enable automatic rotation',
  'automation.enable.description': 'Apply a new wallpaper on the selected schedule.',
  'automation.interval.label': 'Every',
  'automation.interval.option': 'Every {hours} hours',
  'automation.target.label': 'Apply to',
  'automation.target.home': 'Apply to Home screen',
  'automation.target.lock': 'Apply to Lock screen',
  'automation.target.both': 'Apply to both screens',
  'automation.favoritesOnly.label': 'Use favorite quotes only',
  'automation.favoritesOnly.description': 'Rotation will use only your saved quotes.',
  'automation.save': 'Save automation preferences',
  'automation.run': 'Run rotation now',
  'automation.lastQuote': 'Last quote: {text}',
  'automation.lastQuote.fallback': 'saved quote',
  'automation.status.label': 'Service status {state} {intervalHours} {target}',

  'settings.eyebrow': 'KEEP IT YOURS',
  'settings.title': 'Settings',
  'settings.preset.title': 'Current preset',
  'settings.preset.action': 'Customize preset',
  'settings.preset.hint': 'Opens Customize to choose your preferred wallpaper preset.',
  'settings.randomize.label': 'Randomize preset',
  'settings.randomize.description':
    'Use a different curated style when rotation becomes available.',
  'settings.favoritesOnly.label': 'Use favorite quotes only',
  'settings.favoritesOnly.description': 'Keep future rotation focused on saved quotes.',
  'settings.randomize.updated': 'Random preset preference updated.',
  'settings.favoritesOnly.updated': 'Favorite quote preference updated.',
  'settings.error': 'Could not update rotation preferences. Try again.',
  'settings.retry.label': 'Retry preference update',
  'settings.retry.hint': 'Retries updating the preference used by wallpaper rotation.',
  'settings.about.title': 'About Motivana',
  'settings.about.message':
    'Create a focused wallpaper from a thought worth returning to.',
  'settings.appLanguage.label': 'Interface language',
  'settings.appLanguage.description': 'Sets the language of buttons and labels.',
  'settings.contentLanguage.label': 'Quote language',
  'settings.contentLanguage.description': 'Sets the language of the quotes you see.',
  'settings.language.updated': 'Language preference updated.',
  'settings.language.error': 'Could not update the language. Try again.',
  'language.en': 'English',
  'language.vi': 'Tiếng Việt',

  'preview.item.hint': 'Applies this wallpaper style and returns to Home.',
  'preset.thumbnail.label': 'Use {name} preset',

  'actions.save.label': 'Save wallpaper',
  'actions.save.hint': 'Exports the current wallpaper and saves it to your photos.',
  'actions.set.label': 'Set wallpaper',
  'actions.set.hint': 'Choose which supported screen receives the current wallpaper.',
  'actions.retry.label': 'Retry wallpaper action',
  'actions.retry.hint': 'Repeats the failed action using the same exported wallpaper.',
  'actions.appSettings.label': 'Open app settings',
  'actions.appSettings.hint':
    "Opens this app's Android settings so photo permission can be enabled.",
  'actions.export.failed': 'Export failed: {code}.',

  'preset.midnight-focus.name': 'Midnight Focus',
  'preset.sunrise-drive.name': 'Sunrise Drive',
  'preset.forest-discipline.name': 'Forest Discipline',
  'preset.violet-growth.name': 'Violet Growth',
  'preset.paper-confidence.name': 'Paper Confidence',
  'preset.ocean-success.name': 'Ocean Success',
  'preset.ember-action.name': 'Ember Action',
  'preset.mono-clarity.name': 'Mono Clarity',
} as const;
```

- [ ] **Step 4: Write `t()`**

Create `src/features/i18n/t.ts`:

```ts
import type { Locale } from './locale';
import { en } from './strings/en';
import { vi } from './strings/vi';

export type StringKey = keyof typeof en;

const catalogs: Record<Locale, Record<StringKey, string>> = { en, vi };

export function t(
  locale: Locale,
  key: StringKey,
  params?: Record<string, string | number>,
): string {
  const template = catalogs[locale][key];
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
```

Task 6 also creates `src/features/i18n/strings/vi.ts`, so `t.ts` compiles. Build it by copying `en.ts` and changing only the declaration line:

```bash
cp src/features/i18n/strings/en.ts src/features/i18n/strings/vi.ts
```

Then in `vi.ts` replace the first line with:

```ts
import { en } from './en';

export const vi: Record<keyof typeof en, string> = {
```

Every value stays English until Task 8. The annotation means a key removed from `en.ts` breaks the build here, which is the guarantee this design relies on.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm jest src/features/i18n`
Expected: PASS, 6 tests across the two i18n suites.

- [ ] **Step 6: Run the full check and commit**

```bash
pnpm verify
git add -A
git commit -m "feat: add interface string catalog"
```

---

### Task 7: Wire the screens to the catalog

**Files:**
- Create: `src/components/Choice.tsx` (moved out of `app/automation.tsx`)
- Create: `src/features/i18n/useTranslate.ts`
- Modify: `app/index.tsx`, `app/customize.tsx`, `app/favorites.tsx`, `app/automation.tsx`, `app/settings.tsx`
- Modify: `src/components/PresetThumbnail.tsx`, `src/components/QuoteListItem.tsx`, `src/components/WallpaperActions.tsx`
- Modify: `assets/data/presets.json` (remove `name`), `src/features/wallpaper/types.ts`, `scripts/verify-data.mjs`
- Modify: `app/__tests__/home.test.tsx`, `app/__tests__/settings.test.tsx`, `app/__tests__/automation.test.tsx`, `app/__tests__/favorites.test.tsx`

**Interfaces:**
- Consumes: `t`, `StringKey`, the store's `appLocale`.
- Produces: `useTranslate(): (key: StringKey, params?: Record<string, string | number>) => string`, and `Choice` with props `{ label: string; selected: boolean; onPress: () => void }`.

- [ ] **Step 1: Write the failing test**

Add to `app/__tests__/settings.test.tsx`:

```ts
// Mutation caught: reading a hard-coded English string would leave the interface English after the reader picks Vietnamese.
test('renders the interface in the stored app language', async () => {
  const store = createAppStore({ storage: createMemoryStorage() });
  await store.getState().setAppLocale('vi');

  render(<SettingsScreen />);

  expect(await screen.findByText('Cài đặt')).toBeTruthy();
});
```

Match the existing test setup in that file for how the store and storage are provided; do not invent a new harness.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest app/__tests__/settings.test.tsx`
Expected: FAIL, the screen renders `Settings`.

- [ ] **Step 3: Add the hook**

Create `src/features/i18n/useTranslate.ts`:

```ts
import { useCallback } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { t, type StringKey } from './t';

export function useTranslate() {
  const appLocale = useAppStore((state) => state.appLocale);
  return useCallback(
    (key: StringKey, params?: Record<string, string | number>) =>
      t(appLocale, key, params),
    [appLocale],
  );
}
```

- [ ] **Step 4: Extract `Choice`**

Move the local `Choice` component out of `app/automation.tsx` into `src/components/Choice.tsx` unchanged, export it, and import it in both `app/automation.tsx` and `app/settings.tsx`. Settings needs it for the two language pickers in Task 8.

- [ ] **Step 5: Replace every literal**

In each screen and component, call `const translate = useTranslate();` and replace the literal with `translate('<key>')`, using the key table in `src/features/i18n/strings/en.ts`. The mapping is one to one with the values, so match on the exact English text.

Import `type StringKey` from `src/features/i18n/t` in every file that casts a computed key (`PresetThumbnail.tsx`, `app/settings.tsx`).

The interpolated sites become:

- `app/automation.tsx:224` — `translate('automation.interval.option', { hours })`
- `app/automation.tsx:177` — `translate('automation.status.label', { state: ..., intervalHours: ..., target: ... })`
- `app/automation.tsx:199` — read the locale with `const contentLocale = useAppStore((state) => state.contentLocale);`, then `translate('automation.lastQuote', { text: lastQuote ? favoriteQuoteText(lastQuote, contentLocale) : translate('automation.lastQuote.fallback') })`. This uses `favoriteQuoteText`, not `quoteText`, because the last applied quote can be a favorite in the other language.
- `src/components/PresetThumbnail.tsx:35` — `translate('preset.thumbnail.label', { name: translate(\`preset.${preset.id}.name\` as StringKey) })`
- `src/components/WallpaperActions.tsx:44` — `translate('actions.export.failed', { code })`

- [ ] **Step 6: Move the preset names**

Remove the `name` field from every entry in `assets/data/presets.json`, drop `name` from the preset type in `src/features/wallpaper/types.ts`, and remove the `name` validation from `scripts/verify-data.mjs`. Read the display name through `translate(\`preset.${preset.id}.name\` as StringKey)` at the two sites that showed it: `src/components/PresetThumbnail.tsx:35` and the current preset row in `app/settings.tsx:75-86`.

Add to `src/features/wallpaper/__tests__/presetRepository.test.ts`:

```ts
// Mutation caught: a preset without a catalog entry would render an empty name in Customize.
test('every preset has a name in the string catalog', () => {
  for (const preset of getAllPresets()) {
    expect(en[`preset.${preset.id}.name` as keyof typeof en]).toBeTruthy();
  }
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, all suites. Update any screen test that asserts an English literal to read it through `t('en', '<key>')` so the assertion follows the catalog.

- [ ] **Step 8: Run the full check and commit**

```bash
pnpm verify
git add -A
git commit -m "feat: render interface text from the string catalog"
```

---

### Task 8: Vietnamese interface and the language pickers

**Files:**
- Modify: `src/features/i18n/strings/vi.ts`
- Modify: `app/settings.tsx`
- Create: `src/features/i18n/__tests__/catalogParity.test.ts`
- Modify: `app/__tests__/settings.test.tsx`

**Interfaces:**
- Consumes: `Choice`, `useTranslate`, `setAppLocale`, `setContentLocale`, `locales`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Create `src/features/i18n/__tests__/catalogParity.test.ts`:

```ts
import { en } from '../strings/en';
import { vi } from '../strings/vi';

// Mutation caught: a Vietnamese value left in English would ship a half-translated interface with no failing build.
test('every Vietnamese entry differs from English except proper nouns', () => {
  const sameByDesign = new Set([
    'home.title',
    'settings.about.title',
    'language.en',
    'language.vi',
  ]);
  const untranslated = Object.keys(en).filter(
    (key) =>
      !sameByDesign.has(key) &&
      vi[key as keyof typeof en] === en[key as keyof typeof en],
  );

  expect(untranslated).toEqual([]);
});

// Mutation caught: a missing placeholder would drop the interpolated value from the Vietnamese string.
test('keeps the placeholders of every English template', () => {
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();
    expect(placeholders(vi[key]), key).toEqual(placeholders(en[key]));
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/features/i18n/__tests__/catalogParity.test.ts`
Expected: FAIL, every `vi` value still equals the English one.

- [ ] **Step 3: Translate the catalog**

Replace every value in `src/features/i18n/strings/vi.ts`. Keep every `{placeholder}` exactly as it appears in English. Use these:

```ts
  'common.back.label': 'Về Trang chính',
  'common.back.hint': 'Trở lại bản xem trước hình nền.',

  'home.eyebrow': 'HIỆN RÕ ĐIỀU BẠN TẬP TRUNG',
  'home.title': 'Motivana',
  'home.loading': 'Đang chuẩn bị hình nền',
  'home.customize.label': 'Tùy chỉnh hình nền',
  'home.customize.hint': 'Chọn một kiểu hình nền.',
  'home.favorites.label': 'Mở danh sách yêu thích',
  'home.favorites.hint': 'Xem các câu nói yêu thích.',
  'home.automation.label': 'Mở tự động đổi nền',
  'home.automation.hint': 'Xem lại tùy chọn đổi hình nền.',
  'home.settings.label': 'Mở cài đặt',
  'home.settings.hint': 'Thay đổi tùy chọn ứng dụng.',
  'home.previous.label': 'Câu trước',
  'home.previous.hint': 'Hiện câu nói trước đó.',
  'home.next.label': 'Câu tiếp theo',
  'home.next.hint': 'Hiện một câu nói bất kỳ.',
  'home.favorite.hint': 'Thêm hoặc bỏ câu này khỏi danh sách yêu thích.',
  'home.favorite.retry.label': 'Thử lưu lại yêu thích',
  'home.favorite.retry.hint': 'Thử cập nhật lại câu yêu thích dùng cho đổi hình nền.',
  'home.preview.title': 'Xem trước hình nền',
  'home.preview.error': 'Không hiển thị được bản xem trước.',
  'home.preview.retry.label': 'Thử xem trước lại',
  'home.preview.retry.hint': 'Thử vẽ lại hình nền hiện tại.',

  'customize.eyebrow': 'NHỊP HÌNH ẢNH CỦA BẠN',
  'customize.title': 'Tùy chỉnh',
  'customize.error': 'Không cập nhật được kiểu nền dùng để đổi. Hãy thử lại.',
  'customize.retry.label': 'Thử cập nhật kiểu nền',
  'customize.retry.hint': 'Thử cập nhật lại kiểu nền dùng cho đổi hình nền.',

  'favorites.eyebrow': 'GIỮ ĐIỀU CHẠM TỚI BẠN',
  'favorites.title': 'Yêu thích',
  'favorites.empty.title': 'Chưa có câu yêu thích',
  'favorites.empty.message': 'Hãy thêm một câu từ Trang chính để dùng ở đây.',
  'favorites.item.hint': 'Dùng câu yêu thích này cho hình nền Trang chính.',

  'automation.eyebrow': 'TỰ ĐỘNG',
  'automation.title': 'Đổi hình nền',
  'automation.available.title': 'Có thể đặt hình nền',
  'automation.available.message':
    'Việc đổi nền chạy theo khoảng thời gian gần đúng; Android có thể hoãn lại để tiết kiệm pin.',
  'automation.attention.title': 'Việc đổi nền cần được xem lại',
  'automation.enable.label': 'Bật đổi hình nền tự động',
  'automation.enable.description': 'Đặt hình nền mới theo lịch bạn chọn.',
  'automation.interval.label': 'Mỗi',
  'automation.interval.option': 'Mỗi {hours} giờ',
  'automation.target.label': 'Áp dụng cho',
  'automation.target.home': 'Áp dụng cho Trang chính',
  'automation.target.lock': 'Áp dụng cho Màn hình khóa',
  'automation.target.both': 'Áp dụng cho cả hai màn hình',
  'automation.favoritesOnly.label': 'Chỉ dùng câu yêu thích',
  'automation.favoritesOnly.description': 'Chỉ dùng các câu bạn đã lưu.',
  'automation.save': 'Lưu tùy chọn tự động',
  'automation.run': 'Đổi nền ngay',
  'automation.lastQuote': 'Câu gần nhất: {text}',
  'automation.lastQuote.fallback': 'câu đã lưu',
  'automation.status.label': 'Trạng thái dịch vụ {state} {intervalHours} {target}',

  'settings.eyebrow': 'GIỮ THEO CÁCH CỦA BẠN',
  'settings.title': 'Cài đặt',
  'settings.preset.title': 'Kiểu nền hiện tại',
  'settings.preset.action': 'Tùy chỉnh kiểu nền',
  'settings.preset.hint': 'Mở Tùy chỉnh để chọn kiểu hình nền bạn thích.',
  'settings.randomize.label': 'Đổi kiểu nền ngẫu nhiên',
  'settings.randomize.description': 'Dùng một kiểu nền khác khi tính năng đổi nền sẵn sàng.',
  'settings.favoritesOnly.label': 'Chỉ dùng câu yêu thích',
  'settings.favoritesOnly.description': 'Chỉ dùng các câu bạn đã lưu cho lần đổi nền sau.',
  'settings.randomize.updated': 'Đã cập nhật tùy chọn kiểu nền ngẫu nhiên.',
  'settings.favoritesOnly.updated': 'Đã cập nhật tùy chọn câu yêu thích.',
  'settings.error': 'Không cập nhật được tùy chọn đổi nền. Hãy thử lại.',
  'settings.retry.label': 'Thử cập nhật tùy chọn',
  'settings.retry.hint': 'Thử cập nhật lại tùy chọn dùng cho đổi hình nền.',
  'settings.about.title': 'About Motivana',
  'settings.about.message': 'Tạo một hình nền tập trung từ một suy nghĩ đáng quay lại.',
  'settings.appLanguage.label': 'Ngôn ngữ giao diện',
  'settings.appLanguage.description': 'Đặt ngôn ngữ cho nút và nhãn.',
  'settings.contentLanguage.label': 'Ngôn ngữ câu nói',
  'settings.contentLanguage.description': 'Đặt ngôn ngữ cho các câu nói bạn xem.',
  'settings.language.updated': 'Đã cập nhật tùy chọn ngôn ngữ.',
  'settings.language.error': 'Không cập nhật được ngôn ngữ. Hãy thử lại.',
  'language.en': 'English',
  'language.vi': 'Tiếng Việt',

  'preview.item.hint': 'Dùng kiểu nền này và trở lại Trang chính.',
  'preset.thumbnail.label': 'Dùng kiểu nền {name}',

  'actions.save.label': 'Lưu hình nền',
  'actions.save.hint': 'Xuất hình nền hiện tại và lưu vào ảnh của bạn.',
  'actions.set.label': 'Đặt hình nền',
  'actions.set.hint': 'Chọn màn hình nào nhận hình nền hiện tại.',
  'actions.retry.label': 'Thử đặt hình nền lại',
  'actions.retry.hint': 'Làm lại thao tác đã lỗi với cùng hình nền đã xuất.',
  'actions.appSettings.label': 'Mở cài đặt ứng dụng',
  'actions.appSettings.hint': 'Mở cài đặt Android của ứng dụng để bật quyền truy cập ảnh.',
  'actions.export.failed': 'Xuất ảnh lỗi: {code}.',

  'preset.midnight-focus.name': 'Tập Trung Nửa Đêm',
  'preset.sunrise-drive.name': 'Động Lực Ban Mai',
  'preset.forest-discipline.name': 'Kỷ Luật Rừng Xanh',
  'preset.violet-growth.name': 'Trưởng Thành Tím',
  'preset.paper-confidence.name': 'Tự Tin Trên Giấy',
  'preset.ocean-success.name': 'Thành Công Đại Dương',
  'preset.ember-action.name': 'Hành Động Rực Lửa',
  'preset.mono-clarity.name': 'Rõ Ràng Đơn Sắc',
```

`home.title` and `settings.about.title` stay English because they name the product. `language.en` stays `English`, so each language reads in its own name.

- [ ] **Step 4: Add the two language pickers**

In `app/settings.tsx`, add two sections above the About block. Follow the section pattern already used in `app/automation.tsx:216-232`:

```tsx
        <View style={styles.section}>
          <Text allowFontScaling style={styles.label}>
            {translate('settings.appLanguage.label')}
          </Text>
          <Text allowFontScaling style={styles.description}>
            {translate('settings.appLanguage.description')}
          </Text>
          <View style={styles.choices}>
            {locales.map((locale) => (
              <Choice
                key={locale}
                label={translate(`language.${locale}` as StringKey)}
                selected={state.appLocale === locale}
                onPress={() => void updateLanguage('app', locale)}
              />
            ))}
          </View>
        </View>
```

Repeat for the quote language, using `state.contentLocale` and `updateLanguage('content', locale)`. Add `updateLanguage` beside the existing `updatePreference`, following its shape: guard on `pending`, call `setAppLocale` or `setContentLocale`, then set the feedback from `settings.language.updated` or `settings.language.error`.

- [ ] **Step 5: Write the picker test**

Add to `app/__tests__/settings.test.tsx`:

```ts
// Mutation caught: wiring both pickers to one action would change the quote language when the reader only wanted a Vietnamese interface.
test('changes the interface language without changing the quote language', async () => {
  const store = createAppStore({ storage: createMemoryStorage() });
  render(<SettingsScreen />);

  fireEvent.press(screen.getByLabelText('Tiếng Việt'));

  expect(store.getState().appLocale).toBe('vi');
  expect(store.getState().contentLocale).toBe('en');
});
```

Adjust the harness to match the existing tests in that file.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, all suites.

- [ ] **Step 7: Run the full check and commit**

```bash
pnpm verify
git add -A
git commit -m "feat: add Vietnamese interface and language pickers"
```

---

### Task 9: Vietnamese quotes and the renderer fixture

**Files:**
- Modify: `assets/data/quotes.json` (add `text.vi` to 30 quotes, 5 per category)
- Modify: `assets/data/renderer-golden-fixture.json` (add Vietnamese cases)
- Modify: `src/features/quotes/__tests__/quoteRepository.test.ts` (unskip the Vietnamese pool tests from Task 4)
- Modify: `scripts/verify-data.mjs`

**Interfaces:**
- Consumes: everything from Tasks 2, 3, and 4.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Add to `src/features/quotes/__tests__/quoteRepository.test.ts`, and unskip the two `test.skip` cases from Task 4:

```ts
// Mutation caught: an unbalanced first batch would leave a category with too few quotes and repeat during rotation.
test('ships the Vietnamese first batch with 5 quotes in every category', () => {
  const vietnamese = getAllQuotes('vi');

  expect(vietnamese).toHaveLength(30);
  for (const category of quoteCategories) {
    expect(
      vietnamese.filter((quote) => quote.category === category),
    ).toHaveLength(5);
  }
});

// Mutation caught: shipping only translations would leave the original-Vietnamese path untested.
test('includes an original Vietnamese quote in every category', () => {
  const original = getAllQuotes('vi').filter((quote) => quote.sourceLocale === 'vi');

  expect(new Set(original.map((quote) => quote.category)).size).toBe(
    quoteCategories.length,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/features/quotes`
Expected: FAIL, `getAllQuotes('vi')` is empty.

- [ ] **Step 3: Add the Vietnamese batch**

Add `text.vi` to 5 quotes in each of the 6 categories, 30 quotes total. In each category, set `sourceLocale: 'vi'` on exactly one quote and write original Vietnamese for it, with `text.en` a translation of that Vietnamese. Every Vietnamese string must be 12 to 160 characters.

Rules for the writer:

- Translate the idea, not the words. A Vietnamese motivational line reads differently from an English one.
- Keep tone marks correct. The renderer test in Step 4 covers the tall glyphs.
- Do not add an author.

- [ ] **Step 4: Add the Vietnamese renderer cases**

Add two cases to `assets/data/renderer-golden-fixture.json`, following the shape of the existing entries. Use the condensed Oswald presets, which run the largest preferred font size and are the most likely to clip a stacked tone mark:

- name `vietnamese-tall-diacritics-paper-9x20`, preset `paper-confidence`, dimensions 1080x2400, quote text with stacked marks such as `Mỗi lựa chọn nhỏ hôm nay quyết định điều bạn giữ được ngày mai.`
- name `vietnamese-tall-diacritics-ember-9x20`, preset `ember-action`, dimensions 1080x2400, the same text.

Generate the `expected` block by running the existing golden fixture test once and copying the measured values, the same way the current cases were produced. Do not hand-write the numbers.

- [ ] **Step 5: Add the batch rule to the verifier**

In `scripts/verify-data.mjs`, after the per-quote loop in `validateQuotes`:

```js
  const vietnameseByCategory = new Map(quoteCategories.map((category) => [category, 0]));
  for (const quote of quotes) {
    if (quote.text.vi !== undefined) {
      vietnameseByCategory.set(quote.category, vietnameseByCategory.get(quote.category) + 1);
    }
  }
  for (const [category, count] of vietnameseByCategory) {
    if (count !== 5) {
      fail('assets/data/quotes.json', `must carry 5 Vietnamese quotes in ${category}, found ${count}`);
    }
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, all suites, including the two Vietnamese renderer cases.

- [ ] **Step 7: Check the rendered result on a device**

Run the app, set the quote language to Vietnamese, and open a preset that uses Oswald (`paper-confidence` or `ember-action`). Confirm no tone mark is clipped at the top of a line. If a mark clips, raise `lineHeight` for that preset in `assets/data/presets.json` and regenerate the fixture values, rather than shrinking the font.

- [ ] **Step 8: Run the full check and commit**

```bash
pnpm verify
git add -A
git commit -m "feat: add the Vietnamese quote batch"
```

---

## Verification

After Task 9:

```bash
pnpm verify
```

Expected: `format:check`, `lint`, `typecheck`, `verify:data`, `verify:android-permissions`, and all test suites pass.

Manual checks on a device:

1. Interface Vietnamese with quotes English, and the reverse. Both settings hold after a restart.
2. Favorite an English-only quote, change the quote language to Vietnamese, and open Favorites. The quote is still listed and shows its English text.
3. Turn on `favoriteQuotesOnly` with that favorite, and run rotation. The wallpaper renders the English text.
4. Change the quote language and re-export the same quote. The wallpaper shows the new language, not a cached image.
