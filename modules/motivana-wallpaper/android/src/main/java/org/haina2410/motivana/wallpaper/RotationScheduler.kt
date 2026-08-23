package org.haina2410.motivana.wallpaper

interface RotationWorkScheduler { fun updatePeriodic(name: String, intervalHours: Long): Boolean; fun cancel(name: String): Boolean; fun enqueueDebug(name: String): Boolean }
class RotationScheduler(private val work: RotationWorkScheduler) {
  fun configure(enabled: Boolean, intervalHours: Int): Boolean = if (enabled) work.updatePeriodic(PERIODIC_NAME, intervalHours.toLong()) else work.cancel(PERIODIC_NAME)
  fun runNow(debug: Boolean): String? { if (!debug) return "DEBUG_ONLY"; return if (work.enqueueDebug(DEBUG_NAME)) null else "SCHEDULER_FAILED" }
  companion object { const val PERIODIC_NAME = "motivana.wallpaper.rotation"; const val DEBUG_NAME = "motivana.wallpaper.rotation.debug" }
}
