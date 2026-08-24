package org.haina2410.motivana.wallpaper

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class AutomationPreferencesContractTest {
  private val catalog = RotationCatalog(
    listOf(testEntry("q1", "A valid quote with enough characters."), testEntry("q2", "Another valid quote with enough characters.", "M")),
    listOf(RotationPreset("p1", "Inter", "Regular", "left", .4, .06, .03, 1.2, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000"))),
  )
  private val valid = """{"enabled":true,"intervalHours":6,"target":"home","selectedPresetId":"p1","randomizePreset":false,"favoriteQuoteIds":["q1"],"favoriteQuotesOnly":false}"""

  @Test fun snapshotRoundTripsAllRequiredFieldsAndLastIds() {
    val parsed = RotationSnapshot.parse(valid, catalog) as RotationSnapshotResult.Valid
    val roundTrip = RotationSnapshot.parse(parsed.snapshot.copy(lastQuoteId = "q1", lastPresetId = "p1").toJson(), catalog) as RotationSnapshotResult.Valid
    assertEquals("q1", roundTrip.snapshot.lastQuoteId)
    assertEquals("p1", roundTrip.snapshot.lastPresetId)
  }

  @Test fun snapshotRejectsMissingOrCorruptRequiredFields() {
    assertFalse(RotationSnapshot.parse("{}", catalog).isValid)
    assertFalse(RotationSnapshot.parse("not-json", catalog).isValid)
    assertFalse(RotationSnapshot.parse(valid.replace("\"target\":\"home\",", ""), catalog).isValid)
    assertFalse(RotationSnapshot.parse("$valid trailing", catalog).isValid)
    assertFalse(RotationSnapshot.parse(valid.replace("\"intervalHours\":6", "\"intervalHours\":6.9"), catalog).isValid)
    assertFalse(RotationSnapshot.parse(valid.replace("\"enabled\":true", "\"enabled\":\"true\""), catalog).isValid)
    assertFalse(RotationSnapshot.parse(valid.replace("6", "9223372036854775808"), catalog).isValid)
  }

  @Test fun snapshotRejectsInvalidIntervalTargetAndFavoritesOnlyEligibility() {
    assertFalse(RotationSnapshot.parse(valid.replace("6", "8"), catalog).isValid)
    assertFalse(RotationSnapshot.parse(valid.replace("home", "desk"), catalog).isValid)
    assertEquals("EMPTY_FAVORITES", (RotationSnapshot.parse(valid.replace("[\"q1\"]", "[]").replace("false}", "true}"), catalog) as RotationSnapshotResult.Invalid).code)
  }

  @Test fun statusRetainsSeparateLastAppliedTimeAndStableFields() {
    val parsed = RotationStatus.parse(RotationStatus(true, RotationState.SUCCEEDED, statusUpdatedAt = 20, lastAppliedAt = 10, quoteId = "q1", presetId = "p1").toJson())
    assertEquals(10L, parsed.lastAppliedAt)
    assertEquals(20L, parsed.statusUpdatedAt)
    assertTrue(parsed.state == RotationState.SUCCEEDED)
    assertEquals(RotationState.DISABLED, RotationStatus.parse("{\"enabled\":true,\"state\":\"unknown\"}").state)
    assertEquals(RotationState.DISABLED, RotationStatus.parse("{\"enabled\":true,\"state\":\"failed\",\"errorCode\":\"arbitrary\"}").state)
    assertEquals(RotationState.DISABLED, RotationStatus.parse("{\"enabled\":true,\"state\":\"failed\"} garbage").state)
  }
}
