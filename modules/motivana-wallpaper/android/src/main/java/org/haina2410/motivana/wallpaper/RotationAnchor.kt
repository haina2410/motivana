package org.haina2410.motivana.wallpaper

import java.util.Calendar
import java.util.TimeZone

/**
 * How long to hold the first run back so an anchored schedule lands on the clock
 * hour it promises. A bare twelve hour period saved at three in the afternoon
 * fires at three in the morning, which is not "morning and evening".
 *
 * WorkManager cannot promise the exact minute: Doze and the manufacturer's
 * battery rules defer periodic work, so an anchor is the earliest the run may
 * happen rather than the moment it will. Re-anchoring on each configure keeps
 * that slippage from accumulating.
 */
object RotationAnchor {
  /** The clock hours an anchored schedule aims for, ascending. Empty when unanchored. */
  fun anchorHours(intervalHours: Int, anchorHour: Int?): List<Int> {
    if (anchorHour == null || intervalHours <= 0) return emptyList()
    val hours = mutableListOf<Int>()
    var hour = anchorHour
    while (hour < 24) {
      hours.add(hour)
      hour += intervalHours
    }
    return hours
  }

  /**
   * Millis from [nowMillis] until the next anchored hour, or zero when the
   * schedule is unanchored and should simply start a period from now.
   */
  fun initialDelayMillis(
    intervalHours: Int,
    anchorHour: Int?,
    nowMillis: Long,
    timeZone: TimeZone = TimeZone.getDefault(),
  ): Long {
    val hours = anchorHours(intervalHours, anchorHour)
    if (hours.isEmpty()) return 0L
    for (hour in hours) {
      val candidate = atHour(nowMillis, hour, 0, timeZone)
      if (candidate >= nowMillis) return candidate - nowMillis
    }
    return atHour(nowMillis, hours.first(), 1, timeZone) - nowMillis
  }

  private fun atHour(
    nowMillis: Long,
    hour: Int,
    dayOffset: Int,
    timeZone: TimeZone,
  ): Long {
    val calendar = Calendar.getInstance(timeZone)
    calendar.timeInMillis = nowMillis
    calendar.add(Calendar.DAY_OF_YEAR, dayOffset)
    calendar.set(Calendar.HOUR_OF_DAY, hour)
    calendar.set(Calendar.MINUTE, 0)
    calendar.set(Calendar.SECOND, 0)
    calendar.set(Calendar.MILLISECOND, 0)
    return calendar.timeInMillis
  }
}
