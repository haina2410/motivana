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
  @After fun reset() { WallpaperRotationWorkerFactory.testExecution = null }
  @Test fun actualWorkerMapsInjectedPipelineResults() {
    WallpaperRotationWorkerFactory.testExecution = { RotationWorkerExecution { RotationWorkResult.SUCCESS } }
    val success = TestListenableWorkerBuilder<WallpaperRotationWorker>(ApplicationProvider.getApplicationContext()).build().startWork().get()
    assertEquals(ListenableWorker.Result.success(), success)
    WallpaperRotationWorkerFactory.testExecution = { RotationWorkerExecution { RotationWorkResult.RETRY } }
    val retry = TestListenableWorkerBuilder<WallpaperRotationWorker>(ApplicationProvider.getApplicationContext()).build().startWork().get()
    assertEquals(ListenableWorker.Result.retry(), retry)
  }
}
