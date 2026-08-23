package org.haina2410.motivana.wallpaper

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class AndroidRotationWorkScheduler(context: Context) : RotationWorkScheduler {
  private val manager = WorkManager.getInstance(context)
  private val constraints = Constraints.Builder().setRequiresBatteryNotLow(true).build()
  override fun updatePeriodic(name: String, intervalHours: Long) {
    val request = PeriodicWorkRequestBuilder<WallpaperRotationWorker>(intervalHours, TimeUnit.HOURS).setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES).build()
    manager.enqueueUniquePeriodicWork(name, ExistingPeriodicWorkPolicy.UPDATE, request)
  }
  override fun cancel(name: String) { manager.cancelUniqueWork(name) }
  override fun enqueueDebug(name: String) { manager.enqueueUniqueWork(name, ExistingWorkPolicy.REPLACE, OneTimeWorkRequestBuilder<WallpaperRotationWorker>().setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES).build()) }
}
