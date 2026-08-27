package org.haina2410.motivana.wallpaper

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class AndroidRotationWorkScheduler private constructor(private val manager: WorkManager) : RotationWorkScheduler {
  constructor(context: Context) : this(WorkManager.getInstance(context))
  private val constraints = Constraints.Builder().setRequiresBatteryNotLow(true).build()
  internal fun periodicRequest(intervalHours: Long, initialDelayMillis: Long): PeriodicWorkRequest = PeriodicWorkRequestBuilder<WallpaperRotationWorker>(intervalHours, TimeUnit.HOURS).setConstraints(constraints).setInitialDelay(initialDelayMillis, TimeUnit.MILLISECONDS).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES).build()
  internal fun debugRequest(): OneTimeWorkRequest = OneTimeWorkRequestBuilder<WallpaperRotationWorker>().setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES).build()
  // CANCEL_AND_REENQUEUE rather than UPDATE: a changed anchor has to take effect
  // now. UPDATE keeps the running period, so a reader who moved from hourly to
  // 6 AM would wait out the old schedule before the new one applied.
  override fun updatePeriodic(name: String, intervalHours: Long, initialDelayMillis: Long): Boolean = try {
    manager.enqueueUniquePeriodicWork(name, ExistingPeriodicWorkPolicy.CANCEL_AND_REENQUEUE, periodicRequest(intervalHours, initialDelayMillis)).result.get(); true
  } catch (_: Exception) { false }
  override fun cancel(name: String): Boolean = try { manager.cancelUniqueWork(name).result.get(); true } catch (_: Exception) { false }
  override fun enqueueDebug(name: String): Boolean = try { manager.enqueueUniqueWork(name, ExistingWorkPolicy.REPLACE, debugRequest()).result.get(); true } catch (_: Exception) { false }
}
