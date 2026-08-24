package org.haina2410.motivana.wallpaper

/** Builds a one-language catalog entry, so tests keep their short quote literals. */
internal fun testEntry(id: String, text: String, author: String? = null, category: String = "", locale: String = RotationLocales.DEFAULT) =
  RotationQuoteEntry(id, mapOf(locale to text), locale, author, category)

/** Wraps a resolved quote as a one-language catalog entry. */
internal fun testEntry(quote: RotationQuote, locale: String = RotationLocales.DEFAULT) =
  RotationQuoteEntry(quote.id, mapOf(locale to quote.text), locale, quote.author, quote.category)
