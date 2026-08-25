package org.haina2410.motivana.wallpaper

import androidx.test.core.app.ApplicationProvider
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class WallpaperRotationWorkerTest {
  @After fun reset() { WallpaperRotationWorkerFactory.testExecution = null; WallpaperRotationWorkerFactory.testPipelineFactory = null }
  @Test fun actualWorkerMapsInjectedPipelineResults() {
    WallpaperRotationWorkerFactory.testExecution = { RotationWorkerExecution { RotationWorkResult.SUCCESS } }
    val success = TestListenableWorkerBuilder<WallpaperRotationWorker>(ApplicationProvider.getApplicationContext()).build().startWork().get()
    assertEquals(ListenableWorker.Result.success(), success)
    WallpaperRotationWorkerFactory.testExecution = { RotationWorkerExecution { RotationWorkResult.RETRY } }
    val retry = TestListenableWorkerBuilder<WallpaperRotationWorker>(ApplicationProvider.getApplicationContext()).build().startWork().get()
    assertEquals(ListenableWorker.Result.retry(), retry)
  }
  @Test fun testListenableWorkerExecutesInjectedRealPipelineAndRecyclesItsBitmap() {
    var recycled = false
    WallpaperRotationWorkerFactory.testPipelineFactory = {
      val catalog = RotationCatalog(listOf(testEntry("q", "A complete worker quote for an injected pipeline.")), listOf(RotationPreset("p", "BeVietnamPro", "Light", "left", .4, .06, .03, 1.2, "#FFFFFF", "#DDEEFF", RotationBackground.Solid("#000000"))))
      val snapshot = RotationSnapshot(true, 6, WallpaperTarget.HOME, "p", false, emptyList(), false)
      RotationPipeline(catalog, object : RotationSnapshotStore {
        override fun read(catalog: RotationCatalog) = RotationSnapshotResult.Valid(snapshot)
        override fun saveSnapshot(snapshot: RotationSnapshot) = true
        override fun saveStatus(status: RotationStatus) = true
      }, RotationSelector(java.util.Random(0)), object : RotationRenderer { override fun render(quote: RotationQuote, preset: RotationPreset) = object : RotationBitmap { override fun recycle() { recycled = true } } }, object : RotationApplier { override fun apply(bitmap: RotationBitmap, target: WallpaperTarget) = Unit }, { 1L })
    }
    val result = TestListenableWorkerBuilder<WallpaperRotationWorker>(ApplicationProvider.getApplicationContext()).build().startWork().get()
    assertEquals(ListenableWorker.Result.success(), result)
    org.junit.Assert.assertTrue(recycled)
  }
}
