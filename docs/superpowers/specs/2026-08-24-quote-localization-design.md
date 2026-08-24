# Quote and App Localization Design

Date: 2026-08-24
Status: Proposed
Locales: English (`en`), Vietnamese (`vi`)

## Goal

Motivana must show quotes and interface text in English or Vietnamese.
Vietnamese quotes can be translations of English quotes, or original
Vietnamese content. The quote must record the language it was written in.

The user selects the interface language and the quote language separately.

## 1. Quote model

Quotes stay one entity with text for each locale. Do not split the catalog
into two sets of quotes.

```ts
export const locales = ['en', 'vi'] as const;
export type Locale = (typeof locales)[number];

export interface Quote {
  id: string;
  category: QuoteCategory;
  sourceLocale: Locale;                    // language the quote was written in
  text: Partial<Record<Locale, string>>;   // text[sourceLocale] is required
  author?: string;
}
```

`sourceLocale` records the original language. Every other key in `text` is
a translation by definition.

### Why linked, not separate

The persisted state stores quote ids: `favoriteQuoteIds`, `currentQuoteId`,
and `lastAppliedQuoteId` in `src/store/schema.ts`. Separate quotes give each
language its own id space, so a language change makes every saved id invalid.
`migratePersistedState` then discards them, and the user loses all favorites.
Linked quotes keep the id stable. Only the text that renders changes.

Selection also stays one pool. `selectRandomQuote`, `getAdjacentQuote`, and
rotation all read one flat array.

### Text length

- Minimum: 12 non-whitespace characters (no change).
- Maximum: 160 characters, for each locale.

The renderer is not the constraint. A 200-character quote still renders at
100% of the preferred font size on 9:19.5 and 9:16 screens, because the safe
box is generous. The cap controls line count, which is visual density: 160
characters gives at most 7 lines.

The cap applies to Vietnamese and English equally. A Vietnamese translation of
English text is usually 10-20% longer, so a shared cap keeps translations tight.

### Catalog content change

Six quotes are longer than the cap: `motivation-020`, `discipline-020`,
`focus-020`, `confidence-020`, `growth-020`, and `success-020`, at 209-226
characters. They render as 9-10 line paragraphs. The other 114 quotes are 100
characters or less.

Rewrite these six to 160 characters or less. Keep their ids, so no favorite
becomes invalid. Do not remove them, because removal drops the ids and
`migratePersistedState` discards saved favorites without a message.

These six quotes were renderer stress cases. `verify-data.mjs` required four
quotes of 200-280 characters. That rule is now removed, because
`composition.test.ts` already covers 150-character and 250-character text with
synthetic quotes from `quoteOfLength`. Renderer stress coverage does not need
real catalog content. (Done: commit `fe3cb9e`.)

### Validation

`parseQuoteCatalog` must reject:

- a `sourceLocale` that is not a supported locale
- a missing `text[sourceLocale]`
- any text shorter than 12 or longer than 160 characters
- any key in `text` that is not a supported locale

Apply the same rules in `scripts/verify-data.mjs`.

`quoteRepository` parses the catalog when the module loads, so an invalid
catalog fails at startup. Bad content cannot reach the renderer. There is no
runtime state for a quote that does not qualify, and the renderer must never
strip text to make it fit.

## 2. Two independent languages

| Setting | Controls | Persisted as |
|---|---|---|
| Interface language | The 53 interface strings | `appLocale` |
| Quote language | Which quotes the pool offers | `contentLocale` |

The two are independent. A user can read a Vietnamese interface with English
quotes, or the reverse. Both default to the device language, and both fall back
to `en` when the device language is not supported.

### Quote pool

`getAllQuotes`, `getQuoteById`, `getAdjacentQuote`, and `selectRandomQuote`
take `contentLocale`. Each returns only quotes that have text for that locale.

The pool does not fall back to the other language. English text in a Vietnamese
pool is worse than a different quote.

Add a helper for the text that renders:

```ts
export function quoteText(quote: Quote, locale: Locale): string | undefined;
```

Call sites that read `quote.text` today:

- `src/features/wallpaper/composition.ts:74`
- `src/features/wallpaper/scene.ts:196`
- `src/components/QuoteListItem.tsx:17` and `:23`
- `app/automation.tsx:199`

### Favorites

Favorites have no language restriction. The list can hold quotes in any
language, and every favorite stays usable after the user changes
`contentLocale`.

This is the one place that falls back, because the user chose the quote:

1. Show `text[contentLocale]` when it exists.
2. If not, show the text for `sourceLocale`.

The same rule applies to rotation when `favoriteQuotesOnly` is on. Rotation can
therefore apply a Vietnamese wallpaper while `contentLocale` is `en`. This is
correct: the user favorited that quote.

`migratePersistedState` must keep every favorite id, whatever its language.
`favoriteQuotesOnly` keeps the empty-set guard it already has.

## 3. Interface text

53 strings across the screens and components, including accessibility labels
and hints.

No third-party i18n library. Use a typed catalog and a `t()` helper:

```
src/features/i18n/strings/en.ts   // const en = { ... } as const
src/features/i18n/strings/vi.ts   // const vi: Record<keyof typeof en, string>
src/features/i18n/t.ts
```

`Record<keyof typeof en, string>` makes a missing Vietnamese key a build error.
A library such as i18next resolves a missing key at runtime and falls back to
English without a message, which hides an incomplete translation.

The strings do not need a library:

- 5 strings interpolate a value. None need plural rules. `Every ${hours} hours`
  takes 6, 12, or 24 only, always plural in English, and Vietnamese has no
  plural inflection.
- No string formats a date, a currency, or a number.

Move the 8 preset display names from `assets/data/presets.json` into the string
catalog as `preset.<id>.name`. This keeps `presets.json` for visual
configuration and keeps all display text in one place. `PresetThumbnail.tsx:35`
reads the name for its accessibility label.

## 4. Persisted state

Add `expo-localization` to read the device language. This is a platform API,
not an i18n framework, and it matches the other first-party `expo-*` modules.
`Intl` on Hermes is not reliable without full ICU.

Raise the persisted state to version 2:

```ts
export interface PersistedAppStateV2 {
  version: 2;
  appLocale: Locale;
  contentLocale: Locale;
  // ...all V1 fields
}
```

`hydrateAppState` resets the state when `version > 1` today, so version 2 needs
a real migration. The v1 to v2 migration sets both locales from the device
language, and keeps every other v1 field. It must not discard favorite ids.

Settings gets two controls: interface language and quote language.

## 5. Renderer

### Cache key (done)

The cache key was `${preset.id}-${quote.id}-${width}x${height}`. Quote ids are
stable across locales, so that key served a stale wallpaper after a language
change.

The key now includes an FNV-1a fingerprint of the rendered text. This covers
the language change, the six rewritten quotes, and any later wording edit, so
the key does not need the locale. (Done: commit `5a79112`.)

### Vietnamese typography

Vietnamese stacks tone marks above the vowel, so glyphs are taller than the
Latin text the presets were measured against. All five bundled fonts (Inter,
Lora, Oswald) already cover the full Vietnamese diacritic set, so no font work
is needed.

Measure the Vietnamese line height before you change any ratio. Add a
Vietnamese case to `assets/data/renderer-golden-fixture.json`, and confirm that
no tone mark clips in the condensed Oswald presets (`paper-confidence`,
`ember-action`), which use the largest preferred font size.

## 6. Content volume

Vietnamese ships as a smaller first batch, not all 120 quotes. The design
supports partial coverage: quotes without Vietnamese text stay out of the
Vietnamese pool.

Set the batch size so that each of the 6 categories has enough quotes to keep
rotation varied. The batch must include original Vietnamese quotes
(`sourceLocale: 'vi'`) as well as translations, to prove both paths work.

## Out of scope

- More locales than English and Vietnamese.
- Weighted selection that prefers a native quote over a translation.
  `sourceLocale` makes this possible later.
- Localized author names. Author names are proper nouns.

## Risk

A small Vietnamese batch makes the Vietnamese pool repeat sooner than the
English pool. This is a content decision, not a design limit.
