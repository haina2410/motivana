package org.haina2410.motivana.wallpaper

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class AndroidRotationWorkScheduler private constructor(private val manager: WorkManager) : RotationWorkScheduler {
  constructor(context: Context) : this(WorkManager.getInstance(context))
  private val constraints = Constraints.Builder().setRequiresBatteryNotLow(true).build()
  override fun updatePeriodic(name: String, intervalHours: Long): Boolean = try {
    val request = PeriodicWorkRequestBuilder<WallpaperRotationWorker>(intervalHours, TimeUnit.HOURS).setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES).build()
    manager.enqueueUniquePeriodicWork(name, ExistingPeriodicWorkPolicy.UPDATE, request).result.get(); true
  } catch (_: Exception) { false }
  override fun cancel(name: String): Boolean = try { manager.cancelUniqueWork(name).result.get(); true } catch (_: Exception) { false }
  override fun enqueueDebug(name: String): Boolean = try { manager.enqueueUniqueWork(name, ExistingWorkPolicy.REPLACE, OneTimeWorkRequestBuilder<WallpaperRotationWorker>().setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES).build()).result.get(); true } catch (_: Exception) { false }
}
