package org.haina2410.motivana.wallpaper

interface RotationWorkScheduler { fun updatePeriodic(name: String, intervalHours: Long); fun cancel(name: String); fun enqueueDebug(name: String) }
class RotationScheduler(private val work: RotationWorkScheduler) {
  fun configure(enabled: Boolean, intervalHours: Int) { if (enabled) work.updatePeriodic(PERIODIC_NAME, intervalHours.toLong()) else work.cancel(PERIODIC_NAME) }
  fun runNow(debug: Boolean): String? { if (!debug) return "DEBUG_ONLY"; work.enqueueDebug(DEBUG_NAME); return null }
  companion object { const val PERIODIC_NAME = "motivana.wallpaper.rotation"; const val DEBUG_NAME = "motivana.wallpaper.rotation.debug" }
}
