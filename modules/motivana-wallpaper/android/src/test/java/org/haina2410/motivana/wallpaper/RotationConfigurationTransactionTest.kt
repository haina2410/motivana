package org.haina2410.motivana.wallpaper

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RotationConfigurationTransactionTest {
  private val catalog = RotationCatalog(listOf(testEntry("q", "A test quote of sufficient length.")), listOf(RotationPreset("p", "Inter", "Regular", "left", .4, .06, .03, 1.2, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000"))))
  private val old = RotationSnapshot(false, 6, WallpaperTarget.HOME, "p", false, emptyList(), false)
  private val next = old.copy(enabled = true, intervalHours = 12)
  @Test fun updateCommitsSnapshotWorkThenStatus() { val fixture = Fixture(); assertTrue(fixture.transaction().apply(next, catalog)); assertTrue(fixture.snapshot.enabled) }
  @Test fun scheduleFailureRestoresExactPriorSnapshotAndStatus() { val fixture = Fixture(schedule = false); assertFalse(fixture.transaction().apply(next, catalog)); assertEquals(fixture.oldSnapshotRaw, fixture.rawSnapshot); assertEquals(fixture.oldStatusRaw, fixture.rawStatus) }
  @Test fun disableDoesNotClaimDisabledUntilCancellationAndStatusCommitSucceed() { val fixture = Fixture(status = false); assertFalse(fixture.transaction().apply(old, catalog)); assertEquals(fixture.oldSnapshotRaw, fixture.rawSnapshot); assertEquals(fixture.oldStatusRaw, fixture.rawStatus) }
  @Test fun compensationFailureStillReturnsConfigureFailure() { val fixture = Fixture(status = false, restore = false); assertFalse(fixture.transaction().apply(next, catalog)); assertTrue(fixture.calls >= 2) }
  @Test fun reconfigurationRetainsTheWorkerSelectionUsedToAvoidAnImmediateRepeat() { val fixture = Fixture(); fixture.snapshot = fixture.snapshot.copy(lastQuoteId = "q", lastPresetId = "p"); assertTrue(fixture.transaction().apply(next, catalog)); assertEquals("q", fixture.snapshot.lastQuoteId); assertEquals("p", fixture.snapshot.lastPresetId) }
  private class Fixture(private val schedule: Boolean = true, private val status: Boolean = true, private val restore: Boolean = true) : RotationConfigurationStore {
    var snapshot = RotationSnapshot(false, 6, WallpaperTarget.HOME, "p", false, emptyList(), false); var savedStatus = RotationStatus(false, RotationState.DISABLED); val oldSnapshotRaw: String? = "old-snapshot"; val oldStatusRaw: String? = "old-status"; var rawSnapshot: String? = oldSnapshotRaw; var rawStatus: String? = oldStatusRaw; var calls = 0
    override fun readSnapshot(catalog: RotationCatalog) = RotationSnapshotResult.Valid(snapshot)
    override fun readStatus() = savedStatus
    override fun readRawSnapshot() = rawSnapshot
    override fun readRawStatus() = rawStatus
    override fun saveSnapshot(snapshot: RotationSnapshot): Boolean { this.snapshot = snapshot; rawSnapshot = snapshot.toJson(); return true }
    override fun saveStatus(status: RotationStatus): Boolean { if (!this.status) return false; savedStatus = status; rawStatus = status.toJson(); return true }
    override fun restoreRawSnapshot(value: String?): Boolean { if (!restore) return false; rawSnapshot = value; return true }
    override fun restoreRawStatus(value: String?): Boolean { if (!restore) return false; rawStatus = value; return true }
    fun transaction() = RotationConfigurationTransaction(this, RotationScheduler(object : RotationWorkScheduler { override fun updatePeriodic(name: String, intervalHours: Long): Boolean { calls++; return schedule }; override fun cancel(name: String): Boolean { calls++; return schedule }; override fun enqueueDebug(name: String) = true }), { 1L })
  }
}
