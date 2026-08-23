package org.haina2410.motivana.wallpaper

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RotationConfigurationTransactionTest {
  private val catalog = RotationCatalog(listOf(RotationQuote("q", "A test quote of sufficient length.", null)), listOf(RotationPreset("p", "Inter", "Regular", "left", .4, .06, .03, 1.2, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000"))))
  private val old = RotationSnapshot(false, 6, WallpaperTarget.HOME, "p", false, emptyList(), false)
  private val next = old.copy(enabled = true, intervalHours = 12)
  @Test fun updateCommitsSnapshotWorkThenStatus() { val fixture = Fixture(); assertTrue(fixture.transaction().apply(next, catalog)); assertTrue(fixture.snapshot.enabled) }
  @Test fun scheduleFailureRestoresPriorSnapshotAndStatus() { val fixture = Fixture(schedule = false); assertFalse(fixture.transaction().apply(next, catalog)); assertFalse(fixture.snapshot.enabled) }
  @Test fun statusFailureCompensatesTheWorkAndRestoresPriorState() { val fixture = Fixture(status = false); assertFalse(fixture.transaction().apply(next, catalog)); assertFalse(fixture.snapshot.enabled) }
  private class Fixture(private val schedule: Boolean = true, private val status: Boolean = true) : RotationConfigurationStore {
    var snapshot = RotationSnapshot(false, 6, WallpaperTarget.HOME, "p", false, emptyList(), false); var savedStatus = RotationStatus(false, RotationState.DISABLED)
    override fun readSnapshot(catalog: RotationCatalog) = RotationSnapshotResult.Valid(snapshot)
    override fun readStatus() = savedStatus
    override fun saveSnapshot(snapshot: RotationSnapshot): Boolean { this.snapshot = snapshot; return true }
    override fun saveStatus(status: RotationStatus): Boolean { if (!this.status) return false; savedStatus = status; return true }
    fun transaction() = RotationConfigurationTransaction(this, RotationScheduler(object : RotationWorkScheduler { override fun updatePeriodic(name: String, intervalHours: Long) = schedule; override fun cancel(name: String) = schedule; override fun enqueueDebug(name: String) = true }), { 1L })
  }
}
