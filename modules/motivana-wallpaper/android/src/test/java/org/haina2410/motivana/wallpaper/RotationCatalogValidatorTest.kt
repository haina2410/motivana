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
  @Test(expected = CatalogException::class) fun rejectsMalformedCatalogsInsteadOfPermissiveFallback() { RotationCatalogValidator.validate(catalog().copy(quotes = catalog().quotes.dropLast(1))) }
  @Test(expected = CatalogException::class) fun rejectsUnsupportedFontAndBadColor() { RotationCatalogValidator.validate(catalog().copy(presets = catalog().presets.toMutableList().also { it[0] = it[0].copy(family = "Missing", textColor = "white") })) }
}
