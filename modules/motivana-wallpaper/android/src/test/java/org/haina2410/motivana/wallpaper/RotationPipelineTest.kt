package org.haina2410.motivana.wallpaper

import java.util.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RotationPipelineTest {
  private val catalog = RotationCatalog(listOf(testEntry("q1", "A complete quote suitable for a rotation test.")), listOf(RotationPreset("p1", "BeVietnamPro", "Light", "left", .4, .06, .03, 1.2, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000"))))
  private val snapshot = RotationSnapshot(true, 6, WallpaperTarget.HOME, "p1", false, emptyList(), false)
  @Test fun recordsRunningThenSuccessOnlyAfterApplyAndRecycles() {
    val statuses = mutableListOf<RotationStatus>(); var applied = false; var recycled = false
    val store = object : RotationSnapshotStore { override fun read(c: RotationCatalog) = RotationSnapshotResult.Valid(snapshot); override fun saveSnapshot(s: RotationSnapshot) = applied; override fun saveStatus(s: RotationStatus): Boolean { statuses += s; return true } }
    val result = RotationPipeline(catalog, store, RotationSelector(Random(1)), object : RotationRenderer { override fun render(q: RotationQuote, p: RotationPreset) = object : RotationBitmap { override fun recycle() { recycled = true } } }, object : RotationApplier { override fun apply(bitmap: RotationBitmap, target: WallpaperTarget) { applied = true } }, { 100L }).run()
    assertEquals(RotationWorkResult.SUCCESS, result); assertEquals(listOf(RotationState.RUNNING, RotationState.SUCCEEDED), statuses.map { it.state }); assertTrue(recycled)
  }
  @Test fun permanentSnapshotFailureNeverRetries() {
    val store = object : RotationSnapshotStore { override fun read(c: RotationCatalog) = RotationSnapshotResult.Invalid("INVALID_CONFIGURATION"); override fun saveSnapshot(s: RotationSnapshot) = true; override fun saveStatus(s: RotationStatus) = true }
    val result = RotationPipeline(catalog, store, RotationSelector(Random(1)), throwRenderer(), throwApplier(), { 1L }).run()
    assertEquals(RotationWorkResult.FAILURE, result)
  }
  @Test fun statusCommitFailureIsRetriedInsteadOfSilentlyClaimingPermanentResult() {
    val store = object : RotationSnapshotStore { override fun read(c: RotationCatalog) = RotationSnapshotResult.Invalid("INVALID_CONFIGURATION"); override fun saveSnapshot(s: RotationSnapshot) = true; override fun saveStatus(s: RotationStatus) = false }
    val result = RotationPipeline(catalog, store, RotationSelector(Random(1)), throwRenderer(), throwApplier(), { 1L }).run()
    assertEquals(RotationWorkResult.RETRY, result)
  }
  // Mutation caught: without this the reader's snapshot keeps naming a preset the
  // catalogue dropped, so every run falls back to a fresh random style and the
  // screen keeps showing a choice that no longer exists. A run that had to fall
  // back writes the preset it actually used.
  @Test fun aRunThatFellBackFromARetiredPresetHealsTheStoredSnapshot() {
    val saved = mutableListOf<RotationSnapshot>()
    val stale = snapshot.copy(selectedPresetId = "retired")
    val store = object : RotationSnapshotStore { override fun read(c: RotationCatalog) = RotationSnapshotResult.Valid(stale); override fun saveSnapshot(s: RotationSnapshot): Boolean { saved += s; return true }; override fun saveStatus(s: RotationStatus) = true }
    val result = RotationPipeline(catalog, store, RotationSelector(Random(1)), object : RotationRenderer { override fun render(q: RotationQuote, p: RotationPreset) = object : RotationBitmap { override fun recycle() = Unit } }, object : RotationApplier { override fun apply(bitmap: RotationBitmap, target: WallpaperTarget) = Unit }, { 100L }).run()
    assertEquals(RotationWorkResult.SUCCESS, result)
    assertEquals("p1", saved.single().selectedPresetId)
  }

  // A preset the catalogue still holds is the reader's own choice, so a run
  // never rewrites it.
  @Test fun aRunLeavesALivePresetChoiceAlone() {
    val saved = mutableListOf<RotationSnapshot>()
    val store = object : RotationSnapshotStore { override fun read(c: RotationCatalog) = RotationSnapshotResult.Valid(snapshot); override fun saveSnapshot(s: RotationSnapshot): Boolean { saved += s; return true }; override fun saveStatus(s: RotationStatus) = true }
    RotationPipeline(catalog, store, RotationSelector(Random(1)), object : RotationRenderer { override fun render(q: RotationQuote, p: RotationPreset) = object : RotationBitmap { override fun recycle() = Unit } }, object : RotationApplier { override fun apply(bitmap: RotationBitmap, target: WallpaperTarget) = Unit }, { 100L }).run()
    assertEquals("p1", saved.single().selectedPresetId)
  }

  private fun throwRenderer() = object : RotationRenderer { override fun render(q: RotationQuote, p: RotationPreset): RotationBitmap = throw AssertionError("not reached") }
  private fun throwApplier() = object : RotationApplier { override fun apply(bitmap: RotationBitmap, target: WallpaperTarget) = Unit }
}
