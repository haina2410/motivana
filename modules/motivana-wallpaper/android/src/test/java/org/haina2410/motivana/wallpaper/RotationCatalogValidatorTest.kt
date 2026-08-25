package org.haina2410.motivana.wallpaper

import org.junit.Assert.assertEquals
import org.junit.Test

class RotationCatalogValidatorTest {
  private fun catalog() = RotationCatalog(
    (0 until 120).map { index -> testEntry("q$index", "A valid quote has more than twelve characters $index.", null, listOf("motivation", "discipline", "focus", "confidence", "growth", "success")[index % 6]) },
    listOf("CormorantGaramond-Light", "CormorantGaramond-Regular", "BeVietnamPro-Light", "DancingScript-Medium", "Lora-Regular", "Lora-SemiBold", "CormorantGaramond-Light", "BeVietnamPro-Light").mapIndexed { index, font ->
      val (family, weight) = font.split("-"); RotationPreset("p$index", family, weight, "center", .43, .064, .036, 1.18, "#FFFFFF", "#DDEEFF", RotationBackground.Gradient("#102A56", "#020617", 135.0))
    },
  )
  @Test fun validatesTheRequiredQuoteCategoriesPresetFontsColorsAndIds() { RotationCatalogValidator.validate(catalog()); assertEquals(120, catalog().quotes.size) }
  // A catalogue of any size is legal, so the malformed case is a missing category,
  // not a missing entry.
  @Test(expected = CatalogException::class) fun rejectsMalformedCatalogsInsteadOfPermissiveFallback() { RotationCatalogValidator.validate(catalog().copy(quotes = catalog().quotes.filter { it.category != "success" })) }
  @Test fun acceptsASmallerCatalogueThatKeepsTheFloorInEveryCategory() {
    val trimmed = catalog().quotes.groupBy { it.category }.flatMap { (_, quotes) -> quotes.take(6) }
    RotationCatalogValidator.validate(catalog().copy(quotes = trimmed))
    assertEquals(36, trimmed.size)
  }
  @Test(expected = CatalogException::class) fun rejectsACategoryBelowTheFloor() {
    val thin = catalog().quotes.groupBy { it.category }.flatMap { (category, quotes) -> quotes.take(if (category == "focus") 5 else 6) }
    RotationCatalogValidator.validate(catalog().copy(quotes = thin))
  }
  @Test(expected = CatalogException::class) fun rejectsDuplicateQuoteIds() {
    val duplicated = catalog().quotes.toMutableList().also { it[1] = it[1].copy(id = it[0].id) }
    RotationCatalogValidator.validate(catalog().copy(quotes = duplicated))
  }
  @Test(expected = CatalogException::class) fun rejectsUnsupportedFontAndBadColor() { RotationCatalogValidator.validate(catalog().copy(presets = catalog().presets.toMutableList().also { it[0] = it[0].copy(family = "Missing", textColor = "white") })) }
}
