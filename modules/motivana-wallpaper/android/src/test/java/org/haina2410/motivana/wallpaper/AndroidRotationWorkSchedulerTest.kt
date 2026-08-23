package org.haina2410.motivana.wallpaper

import androidx.test.core.app.ApplicationProvider
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.testing.WorkManagerTestInitHelper
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import java.util.concurrent.TimeUnit
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class AndroidRotationWorkSchedulerTest {
  private lateinit var manager: WorkManager

  @Before fun setUp() {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    WorkManagerTestInitHelper.initializeTestWorkManager(context)
    manager = WorkManager.getInstance(context)
  }

  @After fun tearDown() { manager.cancelAllWork().result.get() }

  @Test fun periodicUpdateReplacesTheUniqueRequestWithRequestedIntervalAndConstraints() {
    val scheduler = AndroidRotationWorkScheduler(ApplicationProvider.getApplicationContext())
    assertTrue(scheduler.updatePeriodic(RotationScheduler.PERIODIC_NAME, 6))
    assertEquals(1, manager.getWorkInfosForUniqueWork(RotationScheduler.PERIODIC_NAME).get().size)
    assertTrue(scheduler.updatePeriodic(RotationScheduler.PERIODIC_NAME, 12))
    val info = manager.getWorkInfosForUniqueWork(RotationScheduler.PERIODIC_NAME).get().single()
    assertEquals(WorkInfo.State.ENQUEUED, info.state)
    assertTrue(info.constraints.requiresBatteryNotLow())
  }

  @Test fun cancelAndDebugUseTheirStableUniqueNames() {
    val scheduler = AndroidRotationWorkScheduler(ApplicationProvider.getApplicationContext())
    scheduler.updatePeriodic(RotationScheduler.PERIODIC_NAME, 24)
    assertTrue(scheduler.cancel(RotationScheduler.PERIODIC_NAME))
    assertTrue(manager.getWorkInfosForUniqueWork(RotationScheduler.PERIODIC_NAME).get().all { it.state == WorkInfo.State.CANCELLED })
    assertTrue(scheduler.enqueueDebug(RotationScheduler.DEBUG_NAME))
    assertEquals(1, manager.getWorkInfosForUniqueWork(RotationScheduler.DEBUG_NAME).get().size)
  }

  @Test fun exactPeriodicAndDebugWorkSpecsHaveRequiredIntervalsBackoffAndBatteryConstraint() {
    val scheduler = AndroidRotationWorkScheduler(ApplicationProvider.getApplicationContext())
    listOf(6L, 12L, 24L).forEach { hours ->
      val work = scheduler.periodicRequest(hours).workSpec
      assertEquals(TimeUnit.HOURS.toMillis(hours), work.intervalDuration)
      assertEquals(TimeUnit.MINUTES.toMillis(15), work.backoffDelayDuration)
      assertTrue(work.constraints.requiresBatteryNotLow())
    }
    val debug = scheduler.debugRequest().workSpec
    assertEquals(TimeUnit.MINUTES.toMillis(15), debug.backoffDelayDuration)
    assertTrue(debug.constraints.requiresBatteryNotLow())
  }
}
