package org.haina2410.motivana.wallpaper

import org.junit.Assert.assertEquals
import org.junit.Test

class RotationConfigureDecoderTest {
  private fun valid() = mutableMapOf<String, Any?>("enabled" to true, "intervalHours" to 6, "target" to "home", "selectedPresetId" to "p", "randomizePreset" to false, "favoriteQuoteIds" to emptyList<String>(), "favoriteQuotesOnly" to false)
  @Test fun decodesOnlyExactNativeContractTypes() { assertEquals(6, RotationConfigureDecoder.decode(valid()).intervalHours) }
  @Test(expected = IllegalArgumentException::class) fun rejectsMissingWrongAndNonIntegralValues() { RotationConfigureDecoder.decode(valid().also { it["enabled"] = "true"; it["intervalHours"] = 6.9 }) }
  @Test(expected = IllegalArgumentException::class) fun rejectsMixedFavoritesInsteadOfFilteringThem() { RotationConfigureDecoder.decode(valid().also { it["favoriteQuoteIds"] = listOf("q1", 3) }) }
}
