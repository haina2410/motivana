package org.haina2410.motivana.wallpaper

import org.junit.Assert.assertEquals
import org.junit.Test

class RotationConfigureDecoderTest {
  private fun valid() = mutableMapOf<String, Any?>("enabled" to true, "intervalHours" to 6, "target" to "home", "selectedPresetId" to "p", "randomizePreset" to false, "favoriteQuoteIds" to emptyList<String>(), "favoriteQuotesOnly" to false)
  @Test fun decodesOnlyExactNativeContractTypes() { assertEquals(6, RotationConfigureDecoder.decode(valid()).intervalHours) }
  @Test(expected = IllegalArgumentException::class) fun rejectsMissingWrongAndNonIntegralValues() { RotationConfigureDecoder.decode(valid().also { it["enabled"] = "true"; it["intervalHours"] = 6.9 }) }
  @Test fun rejectsIntervalsBeforeNarrowingNumbers() {
    listOf(-6L, 0L, 4294967302L, Long.MAX_VALUE, Double.MAX_VALUE).forEach { interval ->
      try {
        RotationConfigureDecoder.decode(valid().also { it["intervalHours"] = interval })
        throw AssertionError("Expected invalid interval: $interval")
      } catch (_: IllegalArgumentException) {
        // expected: accepted interval values must be represented by the original Number, not a wrapped Int.
      }
    }
  }
  @Test(expected = IllegalArgumentException::class) fun rejectsMixedFavoritesInsteadOfFilteringThem() { RotationConfigureDecoder.decode(valid().also { it["favoriteQuoteIds"] = listOf("q1", 3) }) }
}
