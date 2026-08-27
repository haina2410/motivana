package org.haina2410.motivana.wallpaper

import java.io.File
import java.util.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** Proves that a reader's quote language reaches the wallpaper, and that upgrades survive. */
@RunWith(RobolectricTestRunner::class)
class RotationContentLocaleTest {
  private fun assetRoot(): File = generateSequence(File(requireNotNull(System.getProperty("user.dir")))) { it.parentFile }
    .map { it.resolve("assets") }
    .first { it.resolve("data/quotes.json").isFile }
  private fun realQuotes() = RotationCatalogLoader.parseQuotes(assetRoot().resolve("data/quotes.json").readText())
  private fun realCatalog() = RotationCatalog(realQuotes(), RotationCatalogLoader.parsePresets(assetRoot().resolve("data/presets.json").readText()))
  private fun validCatalog() = RotationCatalog(
    (0 until 120).map { index -> testEntry("q$index", "A valid quote has more than twelve characters $index.", null, listOf("motivation", "discipline", "focus", "confidence", "growth", "success")[index % 6]) },
    (0 until 8).map { index -> RotationPreset("p$index", "BeVietnamPro", "Light", "center", .43, .064, .036, 1.18, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000")) },
  )

  // Pins RotationCatalog.kt parseQuotes: `text` is read as an object, never as a string.
  @Test fun parseQuotesReadsEveryLanguageAndNeverYieldsARawJsonBlob() {
    val quotes = realQuotes()
    // Every catalogue entry now carries only the language it was written in, so a
    // two-language entry comes from a literal here to keep the multi-key read pinned.
    val twoLanguages = RotationCatalogLoader.parseQuotes("""[{"id":"q1","category":"focus","sourceLocale":"vi","text":{"vi":"Một câu tiếng Việt đủ dài.","en":"An English rendering long enough."}}]""").single()
    assertEquals(setOf("vi", "en"), twoLanguages.text.keys)
    assertEquals("vi", twoLanguages.sourceLocale)
    RotationLocales.supported.forEach { locale ->
      quotes.forEach { quote -> assertFalse("${quote.id} $locale", quote.resolve(locale).text.startsWith("{")) }
    }
  }

  // Pins RotationModels.kt RotationQuoteEntry.resolve: chosen language, else the original.
  @Test fun resolveUsesTheChosenLanguageAndFallsBackToTheOriginal() {
    val quotes = realQuotes()
    val vietnamese = requireNotNull(quotes.firstOrNull { it.hasLocale("vi") })
    val englishOnly = requireNotNull(quotes.firstOrNull { !it.hasLocale("vi") })
    assertEquals(vietnamese.text.getValue("vi"), vietnamese.resolve("vi").text)
    assertEquals(englishOnly.text.getValue("en"), englishOnly.resolve("vi").text)
  }

  // Pins RotationCatalog.kt select: the general pool keeps only the chosen language.
  @Test fun generalPoolNeverServesAQuoteWithoutTheChosenLanguage() {
    val catalog = realCatalog()
    val vietnamese = catalog.quotes.filter { it.hasLocale("vi") }.map { it.text.getValue("vi") }.toSet()
    assertTrue(vietnamese.size >= 2)
    (0 until 200).forEach { seed ->
      val selection = RotationSelector(Random(seed.toLong())).select(catalog, null, null, null, true, catalog.presets.first().id, "vi")
      assertTrue("seed $seed served ${selection.quote.id}", selection.quote.text in vietnamese)
    }
  }

  // Pins the favorites exception in RotationCatalog.kt select: no language filter there.
  @Test fun favoritesStayUsableInAnyLanguage() {
    val catalog = realCatalog()
    val englishOnly = requireNotNull(catalog.quotes.firstOrNull { !it.hasLocale("vi") })
    assertFalse(englishOnly.hasLocale("vi"))
    val selection = RotationSelector(Random(3)).select(catalog, listOf(englishOnly.id), null, null, false, catalog.presets.first().id, "vi")
    assertEquals(englishOnly.id, selection.quote.id)
    assertEquals(englishOnly.text.getValue("en"), selection.quote.text)
  }

  // Pins the per-locale rules in RotationCatalogValidator.validate.
  @Test fun validatorRejectsAMissingSourceLanguageAndAnOverlongText() {
    val base = validCatalog()
    val orphan = base.quotes[0].copy(text = mapOf("vi" to "Một câu nói dài hơn mười hai ký tự."), sourceLocale = "en")
    assertThrows(CatalogException::class.java) { RotationCatalogValidator.validate(base.copy(quotes = base.quotes.toMutableList().also { it[0] = orphan })) }
    val overlong = base.quotes[0].copy(text = mapOf("en" to "x".repeat(161)))
    assertThrows(CatalogException::class.java) { RotationCatalogValidator.validate(base.copy(quotes = base.quotes.toMutableList().also { it[0] = overlong })) }
    RotationCatalogValidator.validate(base.copy(quotes = base.quotes.toMutableList().also { it[0] = base.quotes[0].copy(text = mapOf("en" to "x".repeat(160))) }))
  }

  // Pins the optional contentLocale in RotationSnapshot.parse: shipped snapshots have no such key.
  @Test fun snapshotWithoutAContentLocaleKeepsTheDefaultLanguage() {
    val catalog = validCatalog()
    val stored = """{"enabled":true,"intervalHours":6,"target":"home","selectedPresetId":"p0","randomizePreset":false,"favoriteQuoteIds":[],"favoriteQuotesOnly":false}"""
    val parsed = RotationSnapshot.parse(stored, catalog) as RotationSnapshotResult.Valid
    assertEquals("en", parsed.snapshot.contentLocale)
    val unsupported = RotationSnapshot.parse(stored.replace("\"favoriteQuotesOnly\":false", "\"favoriteQuotesOnly\":false,\"contentLocale\":\"fr\""), catalog) as RotationSnapshotResult.Valid
    assertEquals("en", unsupported.snapshot.contentLocale)
  }

  // Pins the contentLocale field in RotationSnapshot.toJson.
  @Test fun snapshotRoundTripsTheChosenLanguage() {
    val catalog = validCatalog()
    val snapshot = RotationSnapshot(true, 6, WallpaperTarget.HOME, "p0", false, emptyList(), false, contentLocale = "vi")
    val parsed = RotationSnapshot.parse(snapshot.toJson(), catalog) as RotationSnapshotResult.Valid
    assertEquals("vi", parsed.snapshot.contentLocale)
    assertEquals(snapshot, parsed.snapshot)
  }

  // Pins RotationPipeline.kt: the selector gets the snapshot language, not a fixed one.
  @Test fun pipelineRendersTheLanguageFromTheSnapshot() {
    val catalog = RotationCatalog(
      listOf(RotationQuoteEntry("q1", mapOf("en" to "An English only quote for the pipeline.", "vi" to "Một câu tiếng Việt cho quy trình."), "en", null, "focus")),
      listOf(RotationPreset("p1", "BeVietnamPro", "Light", "left", .4, .06, .03, 1.2, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000"))),
    )
    val rendered = mutableListOf<String>()
    fun run(locale: String) {
      val snapshot = RotationSnapshot(true, 6, WallpaperTarget.HOME, "p1", false, emptyList(), false, contentLocale = locale)
      val store = object : RotationSnapshotStore {
        override fun read(catalog: RotationCatalog) = RotationSnapshotResult.Valid(snapshot)
        override fun saveSnapshot(snapshot: RotationSnapshot) = true
        override fun saveStatus(status: RotationStatus) = true
      }
      val renderer = object : RotationRenderer { override fun render(quote: RotationQuote, preset: RotationPreset): RotationBitmap { rendered += quote.text; return object : RotationBitmap { override fun recycle() = Unit } } }
      val applier = object : RotationApplier { override fun apply(bitmap: RotationBitmap, target: WallpaperTarget) = Unit }
      assertEquals(RotationWorkResult.SUCCESS, RotationPipeline(catalog, store, RotationSelector(Random(1)), renderer, applier, { 1L }).run())
    }
    run("vi")
    run("en")
    assertEquals(listOf(catalog.quotes[0].text.getValue("vi"), catalog.quotes[0].text.getValue("en")), rendered)
  }

  // Pins the fallback in RotationConfigureDecoder: an older JS bundle must not stop rotation.
  @Test fun decoderFallsBackWhenTheLanguageIsAbsentOrUnknown() {
    val options = mutableMapOf<String, Any?>("enabled" to true, "intervalHours" to 12, "target" to "home", "selectedPresetId" to "p0", "randomizePreset" to false, "favoriteQuoteIds" to emptyList<String>(), "favoriteQuotesOnly" to false)
    assertEquals("en", RotationConfigureDecoder.decode(options).contentLocale)
    assertEquals("en", RotationConfigureDecoder.decode(options + ("contentLocale" to "fr")).contentLocale)
    assertEquals("vi", RotationConfigureDecoder.decode(options + ("contentLocale" to "vi")).contentLocale)
  }

  // Pins the "all" setting value: every quote is eligible, and each renders in the language it was written in.
  @Test fun everyLanguageServesTheWholeCatalogueInItsOwnLanguage() {
    val catalog = realCatalog()
    val sourceTexts = catalog.quotes.map { it.text.getValue(it.sourceLocale) }.toSet()
    assertTrue(catalog.quotes.all { it.hasLocale("all") })
    val served = (0 until 200).map { seed ->
      val selection = RotationSelector(Random(seed.toLong())).select(catalog, null, null, null, true, catalog.presets.first().id, "all")
      assertTrue("seed $seed served ${selection.quote.id}", selection.quote.text in sourceTexts)
      selection.quote.id
    }.toSet()
    // An English-only quote is out of the "vi" pool, so serving it proves the pool widened.
    assertTrue(served.any { id -> catalog.quotes.first { it.id == id }.hasLocale("vi").not() })
  }

  // Pins the setting values apart from the catalogue locales: "all" is stored, but is never a text key.
  @Test fun everyLanguageSurvivesTheSnapshotAndTheDecoder() {
    val catalog = validCatalog()
    val snapshot = RotationSnapshot(true, 6, WallpaperTarget.HOME, "p0", false, emptyList(), false, contentLocale = "all")
    val parsed = RotationSnapshot.parse(snapshot.toJson(), catalog) as RotationSnapshotResult.Valid
    assertEquals("all", parsed.snapshot.contentLocale)
    val options = mutableMapOf<String, Any?>("enabled" to true, "intervalHours" to 12, "target" to "home", "selectedPresetId" to "p0", "randomizePreset" to false, "favoriteQuoteIds" to emptyList<String>(), "favoriteQuotesOnly" to false, "contentLocale" to "all")
    assertEquals("all", RotationConfigureDecoder.decode(options).contentLocale)
    assertFalse("all" in RotationLocales.supported)
  }
}
