package org.haina2410.motivana.wallpaper

import java.util.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class RotationSelectorTest {
  private val catalog = RotationCatalog(
    listOf(testEntry("one", "One valid quote has enough characters."), testEntry("two", "Two valid quote has enough characters.")),
    listOf(
      RotationPreset("first", "BeVietnamPro", "Light", "left", .4, .06, .03, 1.2, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000")),
      RotationPreset("second", "DancingScript", "Medium", "right", .4, .06, .03, 1.2, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000")),
    ),
  )
  @Test fun selectionUsesOnlyEligibleQuotesAndAvoidsImmediateRepeat() {
    val value = RotationSelector(Random(7)).select(catalog, listOf("one", "two"), "one", "first", true, "first", RotationLocales.DEFAULT)
    assertEquals("two", value.quote.id)
    assertNotEquals("first", value.preset.id)
  }
  @Test fun preferredPresetIsStableAndEmptyEligibilityDoesNotFallback() {
    assertEquals("first", RotationSelector(Random(1)).select(catalog, listOf("one"), null, null, false, "first", RotationLocales.DEFAULT).preset.id)
    assertThrows(SelectionException::class.java) { RotationSelector(Random(1)).select(catalog, listOf("gone"), null, null, false, "first", RotationLocales.DEFAULT) }
  }

  // Mutation caught: a curated preset can leave the catalogue, and the reader who
  // chose it still holds its id. Throwing here stops that reader's rotation for
  // good. Any preset is a better answer than none.
  @Test fun aPresetTheCatalogueNoLongerHoldsFallsBackToARandomOne() {
    val value = RotationSelector(Random(3)).select(catalog, null, null, null, false, "retired", RotationLocales.DEFAULT)
    assertTrue(catalog.presets.any { it.id == value.preset.id })
  }
}
