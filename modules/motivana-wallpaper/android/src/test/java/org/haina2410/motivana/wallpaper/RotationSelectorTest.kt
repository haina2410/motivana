package org.haina2410.motivana.wallpaper

import java.util.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RotationSelectorTest {
  private val catalog = RotationCatalog(
    listOf(RotationQuote("one", "One valid quote has enough characters.", null), RotationQuote("two", "Two valid quote has enough characters.", null)),
    listOf(
      RotationPreset("first", "Inter", "Regular", "left", .4, .06, .03, 1.2, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000")),
      RotationPreset("second", "Oswald", "Medium", "right", .4, .06, .03, 1.2, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000")),
    ),
  )
  @Test fun selectionUsesOnlyEligibleQuotesAndAvoidsImmediateRepeat() {
    val value = RotationSelector(Random(7)).select(catalog, listOf("one", "two"), "one", "first", true, "first")
    assertEquals("two", value.quote.id)
    assertNotEquals("first", value.preset.id)
  }
  @Test fun preferredPresetIsStableAndEmptyEligibilityDoesNotFallback() {
    assertEquals("first", RotationSelector(Random(1)).select(catalog, listOf("one"), null, null, false, "first").preset.id)
    assertThrows(SelectionException::class.java) { RotationSelector(Random(1)).select(catalog, listOf("gone"), null, null, false, "first") }
  }
}
