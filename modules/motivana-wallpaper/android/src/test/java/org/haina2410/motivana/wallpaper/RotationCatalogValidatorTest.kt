package org.haina2410.motivana.wallpaper

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

// Robolectric supplies org.json, which acceptsTheShippedCatalogue needs to read
// the catalogue files the app ships.
@RunWith(RobolectricTestRunner::class)
class RotationCatalogValidatorTest {
  private fun catalog() = RotationCatalog(
    (0 until 120).map { index -> testEntry("q$index", "A valid quote has more than twelve characters $index.", null, listOf("motivation", "discipline", "focus", "confidence", "growth", "success")[index % 6]) },
    listOf("CormorantGaramond-Light", "CormorantGaramond-Regular", "BeVietnamPro-Light", "DancingScript-Medium", "Lora-Regular", "Lora-SemiBold", "CormorantGaramond-Light", "BeVietnamPro-Light").mapIndexed { index, font ->
      val (family, weight) = font.split("-"); RotationPreset("p$index", family, weight, "center", .43, .064, .036, 1.18, "#FFFFFF", "#DDEEFF", RotationBackground.Gradient("#102A56", "#020617", 135.0))
    },
  )
  private fun assetRoot(): File = generateSequence(File(requireNotNull(System.getProperty("user.dir")))) { it.parentFile }
    .map { it.resolve("assets") }
    .first { it.resolve("data/quotes.json").isFile }

  // Mutation caught: the fixtures above are built to pass, so only the shipped
  // catalogue proves the worker can load what the app ships. A floor here that
  // drifts above scripts/verify-data.mjs leaves the repository green and every
  // rotation on the device failing with ASSET_INVALID.
  @Test fun acceptsTheShippedCatalogue() {
    val shipped = RotationCatalog(
      RotationCatalogLoader.parseQuotes(assetRoot().resolve("data/quotes.json").readText()),
      RotationCatalogLoader.parsePresets(assetRoot().resolve("data/backgrounds.json").readText()),
    )
    RotationCatalogValidator.validate(shipped)
  }

  @Test fun validatesTheRequiredQuoteCategoriesPresetFontsColorsAndIds() { RotationCatalogValidator.validate(catalog()); assertEquals(120, catalog().quotes.size) }
  // A catalogue of any size is legal, so the malformed case is a missing category,
  // not a missing entry.
  @Test(expected = CatalogException::class) fun rejectsMalformedCatalogsInsteadOfPermissiveFallback() { RotationCatalogValidator.validate(catalog().copy(quotes = catalog().quotes.filter { it.category != "success" })) }
  // scripts/verify-data.mjs owns how many quotes a category must hold. A second
  // copy of that number here drifted once already and failed every rotation with
  // ASSET_INVALID, so a thin category is accepted and only a missing one is not.
  @Test fun acceptsACategoryThinnerThanTheRepositoryFloor() {
    val thin = catalog().quotes.groupBy { it.category }.flatMap { (category, quotes) -> quotes.take(if (category == "focus") 1 else 3) }
    RotationCatalogValidator.validate(catalog().copy(quotes = thin))
    assertEquals(16, thin.size)
  }
  @Test(expected = CatalogException::class) fun rejectsDuplicateQuoteIds() {
    val duplicated = catalog().quotes.toMutableList().also { it[1] = it[1].copy(id = it[0].id) }
    RotationCatalogValidator.validate(catalog().copy(quotes = duplicated))
  }
  @Test(expected = CatalogException::class) fun rejectsUnsupportedFontAndBadColor() { RotationCatalogValidator.validate(catalog().copy(presets = catalog().presets.toMutableList().also { it[0] = it[0].copy(family = "Missing", textColor = "white") })) }

  private fun photograph(background: RotationBackground.Image) =
    catalog().let { it.copy(presets = it.presets + it.presets[0].copy(id = "mountain-01", background = background)) }
  private val image = RotationBackground.Image("backgrounds/mountain-01.webp", "#000000", .45, .257)

  // Mutation caught: rejecting the image kind is what stopped the worker from
  // accepting a photograph at all, so a plain-only validator would restore the
  // "Could not update the preset used for rotation" failure.
  @Test fun acceptsAPhotographAlongsideThePlainPresets() { RotationCatalogValidator.validate(photograph(image)) }

  // Mutation caught: an asset path free to name any file would let one entry
  // draw another entry's photograph.
  @Test(expected = CatalogException::class) fun rejectsAnAssetThatDoesNotMatchTheId() {
    RotationCatalogValidator.validate(photograph(image.copy(asset = "backgrounds/ocean-02.webp")))
  }

  // Mutation caught: an opacity outside 0..1 makes an alpha channel wrap around,
  // so a scrim meant to be faint would paint the photograph solid black.
  @Test(expected = CatalogException::class) fun rejectsAScrimOpacityOutsideTheUnitRange() {
    RotationCatalogValidator.validate(photograph(image.copy(scrimOpacity = 1.4)))
  }

  // Mutation caught: the measured luminance is the fallback colour behind the
  // quote, so a value off the scale would leave unreadable text when a decode
  // fails.
  @Test(expected = CatalogException::class) fun rejectsALuminanceOutsideTheUnitRange() {
    RotationCatalogValidator.validate(photograph(image.copy(luminance = -0.1)))
  }
}
