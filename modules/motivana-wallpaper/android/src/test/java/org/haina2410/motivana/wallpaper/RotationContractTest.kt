package org.haina2410.motivana.wallpaper

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RotationContractTest {
  private val catalog = RotationCatalog(
    quotes = listOf(
      testEntry("one", "A sufficiently long quote for the catalog.", "Motivana"),
      testEntry("two", "Another sufficiently long quote for selection."),
    ),
    presets = listOf(
      RotationPreset("first", "BeVietnamPro", "Light", "center", 0.43, 0.06, 0.03, 1.2, "#FFFFFF", "#D9E6FF", RotationBackground.Solid("#000000")),
      RotationPreset("second", "DancingScript", "Medium", "left", 0.43, 0.06, 0.03, 1.2, "#FFFFFF", "#D9E6FF", RotationBackground.Solid("#000000")),
    ),
  )

  @Test fun snapshotRejectsUnknownIdsAndEmptyFavoriteOnly() {
    assertFalse(RotationSnapshot.parse("""{"enabled":true,"intervalHours":8,"target":"home","selectedPresetId":"first","randomizePreset":false,"favoriteQuoteIds":[],"favoriteQuotesOnly":false}""", catalog).isValid)
    assertFalse(RotationSnapshot.parse("""{"enabled":true,"intervalHours":6,"target":"home","selectedPresetId":"gone","randomizePreset":false,"favoriteQuoteIds":[],"favoriteQuotesOnly":false}""", catalog).isValid)
    assertFalse(RotationSnapshot.parse("""{"enabled":true,"intervalHours":6,"target":"home","selectedPresetId":"first","randomizePreset":false,"favoriteQuoteIds":[],"favoriteQuotesOnly":true}""", catalog).isValid)
  }

  // A reader who chose six-hour rotation on the shipped app still has that
  // snapshot on disk, and nothing reconfigures native at launch. Rejecting it
  // would stop their rotation until they opened the screen and pressed Save.
  @Test fun aSnapshotSavedWithARetiredIntervalStillSchedules() {
    assertTrue(RotationSnapshot.parse("""{"enabled":true,"intervalHours":6,"target":"home","selectedPresetId":"first","randomizePreset":false,"favoriteQuoteIds":[],"favoriteQuotesOnly":false}""", catalog).isValid)
  }

  @Test fun theAnchorHourSurvivesTheSnapshotRoundTripAndIsCheckedAgainstTheClock() {
    val snapshot = RotationSnapshot(true, 12, WallpaperTarget.HOME, "first", false, emptyList(), false, anchorHour = 6)
    val parsed = RotationSnapshot.parse(snapshot.toJson(), catalog) as RotationSnapshotResult.Valid
    assertEquals(6 as Int?, parsed.snapshot.anchorHour)
    // An absent anchor stays absent rather than defaulting to a clock hour.
    assertNull((RotationSnapshot.parse(RotationSnapshot(true, 1, WallpaperTarget.HOME, "first", false, emptyList(), false).toJson(), catalog) as RotationSnapshotResult.Valid).snapshot.anchorHour)
    assertFalse(RotationSnapshot.parse("""{"enabled":true,"intervalHours":12,"anchorHour":24,"target":"home","selectedPresetId":"first","randomizePreset":false,"favoriteQuoteIds":[],"favoriteQuotesOnly":false}""", catalog).isValid)
  }

  @Test fun selectionAvoidsImmediateQuoteAndPresetRepeatWhenAlternativesExist() {
    val selected = RotationSelector(java.util.Random(0)).select(catalog, listOf("one", "two"), "one", "first", true, "first", RotationLocales.DEFAULT)
    assertNotEquals("one", selected.quote.id)
    assertNotEquals("first", selected.preset.id)
  }

  @Test fun rendererKeepsTaskFourSafeBoundsAndUsesOnePixelFitting() {
    val rendered = CanvasWallpaperRenderer(catalog, emptyMap()).layout(catalog.quotes.first().resolve(RotationLocales.DEFAULT), catalog.presets.first(), 1080, 2400)
    assertEquals(86.4f, rendered.quoteLeft, 0.01f)
    assertTrue(rendered.quoteTop >= 240f)
    assertTrue(rendered.quoteBottom <= 2160f)
    assertTrue(rendered.fontSize <= 65f && rendered.fontSize >= 32f)
  }

  @Test fun schedulerUsesExactUniqueNamesUpdateAndCancellation() {
    val calls = mutableListOf<String>()
    val scheduler = RotationScheduler(object : RotationWorkScheduler {
      override fun updatePeriodic(name: String, intervalHours: Long, initialDelayMillis: Long): Boolean { calls += "$name:$intervalHours:$initialDelayMillis"; return true }
      override fun cancel(name: String): Boolean { calls += "cancel:$name"; return true }
      override fun enqueueDebug(name: String): Boolean { calls += "debug:$name"; return true }
    })
    scheduler.configure(true, 12, null)
    scheduler.configure(false, 12, null)
    assertEquals(listOf("motivana.wallpaper.rotation:12:0", "cancel:motivana.wallpaper.rotation"), calls)
  }

  @Test fun debugWorkIsRejectedOutsideDebugBuild() {
    val scheduler = RotationScheduler(object : RotationWorkScheduler {
      override fun updatePeriodic(name: String, intervalHours: Long, initialDelayMillis: Long) = true
      override fun cancel(name: String) = true
      override fun enqueueDebug(name: String) = true
    })
    assertEquals("DEBUG_ONLY", scheduler.runNow(false))
  }
}
