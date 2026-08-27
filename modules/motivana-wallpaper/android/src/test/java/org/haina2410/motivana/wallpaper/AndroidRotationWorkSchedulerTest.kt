package org.haina2410.motivana.wallpaper

import androidx.test.core.app.ApplicationProvider
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.testing.WorkManagerTestInitHelper
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
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
    assertTrue(scheduler.updatePeriodic(RotationScheduler.PERIODIC_NAME, 1, 0L))
    assertEquals(1, manager.getWorkInfosForUniqueWork(RotationScheduler.PERIODIC_NAME).get().size)
    assertTrue(scheduler.updatePeriodic(RotationScheduler.PERIODIC_NAME, 12, 0L))
    val info = manager.getWorkInfosForUniqueWork(RotationScheduler.PERIODIC_NAME).get().single()
    assertEquals(WorkInfo.State.ENQUEUED, info.state)
    assertTrue(info.constraints.requiresBatteryNotLow())
  }

  // The open question when this was designed: ExistingPeriodicWorkPolicy.UPDATE
  // keeps the running period, so a changed anchor would not take effect until the
  // old schedule elapsed. CANCEL_AND_REENQUEUE is what makes a saved change apply
  // now; this pins that, so a later switch back to UPDATE fails here.
  @Test fun rescheduleWithANewAnchorReplacesTheEnqueuedWorkRatherThanKeepingTheOldTiming() {
    val scheduler = AndroidRotationWorkScheduler(ApplicationProvider.getApplicationContext())
    assertTrue(scheduler.updatePeriodic(RotationScheduler.PERIODIC_NAME, 1, 0L))
    val first = manager.getWorkInfosForUniqueWork(RotationScheduler.PERIODIC_NAME).get().single()
    assertTrue(scheduler.updatePeriodic(RotationScheduler.PERIODIC_NAME, 24, TimeUnit.HOURS.toMillis(5)))
    val infos = manager.getWorkInfosForUniqueWork(RotationScheduler.PERIODIC_NAME).get()
    val live = infos.single { it.state == WorkInfo.State.ENQUEUED }
    assertNotEquals(first.id, live.id)
    assertEquals(TimeUnit.HOURS.toMillis(5), live.initialDelayMillis)
  }

  @Test fun cancelAndDebugUseTheirStableUniqueNames() {
    val scheduler = AndroidRotationWorkScheduler(ApplicationProvider.getApplicationContext())
    scheduler.updatePeriodic(RotationScheduler.PERIODIC_NAME, 24, 0L)
    assertTrue(scheduler.cancel(RotationScheduler.PERIODIC_NAME))
    assertTrue(manager.getWorkInfosForUniqueWork(RotationScheduler.PERIODIC_NAME).get().all { it.state == WorkInfo.State.CANCELLED })
    assertTrue(scheduler.enqueueDebug(RotationScheduler.DEBUG_NAME))
    assertEquals(1, manager.getWorkInfosForUniqueWork(RotationScheduler.DEBUG_NAME).get().size)
  }

  @Test fun exactPeriodicAndDebugWorkSpecsHaveRequiredIntervalsBackoffAndBatteryConstraint() {
    val scheduler = AndroidRotationWorkScheduler(ApplicationProvider.getApplicationContext())
    listOf(1L, 12L, 24L).forEach { hours ->
      val work = scheduler.periodicRequest(hours, 0L).workSpec
      assertEquals(TimeUnit.HOURS.toMillis(hours), work.intervalDuration)
      assertEquals(TimeUnit.MINUTES.toMillis(15), work.backoffDelayDuration)
      assertTrue(work.constraints.requiresBatteryNotLow())
    }
    // An anchored schedule must carry its wait into the work spec, or the first
    // run lands immediately instead of at the clock hour the reader chose.
    val anchored = scheduler.periodicRequest(24L, TimeUnit.HOURS.toMillis(5)).workSpec
    assertEquals(TimeUnit.HOURS.toMillis(5), anchored.initialDelay)
    val debug = scheduler.debugRequest().workSpec
    assertEquals(TimeUnit.MINUTES.toMillis(15), debug.backoffDelayDuration)
    assertTrue(debug.constraints.requiresBatteryNotLow())
  }
}
