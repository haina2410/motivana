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

  // A setting the app could never have written stays a rejection. A reference the
  // catalogue merely no longer holds does not: see the repair tests below.
  @Test fun snapshotRejectsAnUnwritableIntervalAndEmptyFavoriteOnly() {
    assertFalse(RotationSnapshot.parse("""{"enabled":true,"intervalHours":8,"target":"home","selectedPresetId":"first","randomizePreset":false,"favoriteQuoteIds":[],"favoriteQuotesOnly":false}""", catalog).isValid)
    assertFalse(RotationSnapshot.parse("""{"enabled":true,"intervalHours":6,"target":"home","selectedPresetId":"first","randomizePreset":false,"favoriteQuoteIds":[],"favoriteQuotesOnly":true}""", catalog).isValid)
  }

  // Mutation caught: the catalogue renumbers its quote IDs when entries are
  // culled, so a reader who upgrades holds a lastQuoteId the new catalogue no
  // longer has. That value is bookkeeping the selector uses to avoid an
  // immediate repeat, never a reader's choice, so a stale one is dropped. A
  // rejection here stops rotation for every upgraded reader with
  // INVALID_CONFIGURATION.
  @Test fun aStaleLastSelectionFromAnEarlierCatalogueIsDroppedRatherThanRejected() {
    val parsed = RotationSnapshot.parse("""{"enabled":true,"intervalHours":24,"target":"home","selectedPresetId":"first","randomizePreset":false,"favoriteQuoteIds":[],"favoriteQuotesOnly":false,"lastQuoteId":"confidence-010","lastPresetId":"retired-08"}""", catalog)
    assertTrue(parsed.isValid)
    val snapshot = (parsed as RotationSnapshotResult.Valid).snapshot
    assertNull(snapshot.lastQuoteId)
    assertNull(snapshot.lastPresetId)
  }

  // Mutation caught: culling the catalogue renumbers its quote IDs, so an
  // upgraded reader holds favourites the catalogue no longer has. Rejecting the
  // snapshot stops their rotation; the unknown ones are dropped and the rest of
  // the reader's choices are kept.
  @Test fun favouritesTheCatalogueNoLongerHoldsAreDroppedRatherThanRejected() {
    val parsed = RotationSnapshot.parse("""{"enabled":true,"intervalHours":24,"target":"home","selectedPresetId":"first","randomizePreset":false,"favoriteQuoteIds":["one","gone"],"favoriteQuotesOnly":true}""", catalog)
    assertEquals(listOf("one"), (parsed as RotationSnapshotResult.Valid).snapshot.favoriteQuoteIds)
  }

  // With every favourite gone the reader has a choice to make, so this stays a
  // reported state. EMPTY_FAVORITES is the one the screen can act on.
  @Test fun favouritesOnlyWithNoSurvivingFavouriteReportsEmptyFavorites() {
    val parsed = RotationSnapshot.parse("""{"enabled":true,"intervalHours":24,"target":"home","selectedPresetId":"first","randomizePreset":false,"favoriteQuoteIds":["gone"],"favoriteQuotesOnly":true}""", catalog)
    assertEquals("EMPTY_FAVORITES", (parsed as RotationSnapshotResult.Invalid).code)
  }

  // Mutation caught: a curated preset can leave the catalogue. The reader who
  // chose it keeps a snapshot naming it, and rejecting that snapshot stops their
  // rotation. The selector falls back to a random preset instead.
  @Test fun aSelectedPresetTheCatalogueNoLongerHoldsStillSchedules() {
    assertTrue(RotationSnapshot.parse("""{"enabled":true,"intervalHours":24,"target":"home","selectedPresetId":"retired","randomizePreset":false,"favoriteQuoteIds":[],"favoriteQuotesOnly":false}""", catalog).isValid)
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
