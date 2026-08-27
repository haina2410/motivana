package org.haina2410.motivana.wallpaper

import java.util.Calendar
import java.util.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Test

class RotationAnchorTest {
  private val zone: TimeZone = TimeZone.getTimeZone("Asia/Ho_Chi_Minh")

  private fun at(hour: Int, minute: Int, day: Int = 27): Long {
    val calendar = Calendar.getInstance(zone)
    calendar.set(2026, Calendar.AUGUST, day, hour, minute, 0)
    calendar.set(Calendar.MILLISECOND, 0)
    return calendar.timeInMillis
  }

  private val hour = 60L * 60L * 1000L

  @Test fun unanchoredScheduleStartsAPeriodFromNow() {
    assertEquals(0L, RotationAnchor.initialDelayMillis(1, null, at(14, 20), zone))
  }

  @Test fun twiceDailyAnchorsOnSixAndEighteen() {
    assertEquals(listOf(6, 18), RotationAnchor.anchorHours(12, 6))
    assertEquals(listOf(6), RotationAnchor.anchorHours(24, 6))
    assertEquals(emptyList<Int>(), RotationAnchor.anchorHours(1, null))
  }

  @Test fun dailyWaitsForTheNextSixInTheMorning() {
    assertEquals(hour, RotationAnchor.initialDelayMillis(24, 6, at(5, 0), zone))
    assertEquals(23 * hour, RotationAnchor.initialDelayMillis(24, 6, at(7, 0), zone))
  }

  @Test fun twiceDailyTakesWhicheverAnchorComesNext() {
    assertEquals(3 * hour, RotationAnchor.initialDelayMillis(12, 6, at(3, 0), zone))
    assertEquals(9 * hour, RotationAnchor.initialDelayMillis(12, 6, at(9, 0), zone))
    assertEquals(10 * hour, RotationAnchor.initialDelayMillis(12, 6, at(20, 0), zone))
  }

  @Test fun anExactAnchorRunsNowRatherThanAWholePeriodLater() {
    assertEquals(0L, RotationAnchor.initialDelayMillis(24, 6, at(6, 0), zone))
  }

  @Test fun aLateEveningAnchorRollsIntoTomorrowMorning() {
    assertEquals(7 * hour, RotationAnchor.initialDelayMillis(12, 6, at(23, 0), zone))
  }
}
