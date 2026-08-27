package org.haina2410.motivana.wallpaper

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RotationConfigureDecoderTest {
  private fun valid() = mutableMapOf<String, Any?>("enabled" to true, "intervalHours" to 12, "target" to "home", "selectedPresetId" to "p", "randomizePreset" to false, "favoriteQuoteIds" to emptyList<String>(), "favoriteQuotesOnly" to false)
  @Test fun decodesOnlyExactNativeContractTypes() { assertEquals(12, RotationConfigureDecoder.decode(valid()).intervalHours) }
  @Test(expected = IllegalArgumentException::class) fun rejectsMissingWrongAndNonIntegralValues() { RotationConfigureDecoder.decode(valid().also { it["enabled"] = "true"; it["intervalHours"] = 12.9 }) }
  @Test fun rejectsIntervalsBeforeNarrowingNumbers() {
    listOf(-6L, 0L, 6L, 4294967302L, Long.MAX_VALUE, Double.MAX_VALUE).forEach { interval ->
      try {
        RotationConfigureDecoder.decode(valid().also { it["intervalHours"] = interval })
        throw AssertionError("Expected invalid interval: $interval")
      } catch (_: IllegalArgumentException) {
        // expected: accepted interval values must be represented by the original Number, not a wrapped Int.
      }
    }
  }
  @Test fun readsTheAnchorHourAndTreatsAnAbsentOneAsUnanchored() {
    assertNull(RotationConfigureDecoder.decode(valid()).anchorHour)
    assertEquals(6 as Int?, RotationConfigureDecoder.decode(valid().also { it["anchorHour"] = 6 }).anchorHour)
  }
  @Test fun rejectsAnAnchorOutsideTheClock() {
    listOf(-1, 24, 6.5).forEach { anchor ->
      try {
        RotationConfigureDecoder.decode(valid().also { it["anchorHour"] = anchor })
        throw AssertionError("Expected invalid anchor: $anchor")
      } catch (_: IllegalArgumentException) {
        // expected
      }
    }
  }
  @Test(expected = IllegalArgumentException::class) fun rejectsMixedFavoritesInsteadOfFilteringThem() { RotationConfigureDecoder.decode(valid().also { it["favoriteQuoteIds"] = listOf("q1", 3) }) }
}
