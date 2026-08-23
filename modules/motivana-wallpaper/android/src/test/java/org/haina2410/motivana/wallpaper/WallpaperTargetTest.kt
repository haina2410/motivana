package org.haina2410.motivana.wallpaper

import android.app.WallpaperManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WallpaperTargetTest {
  @Test
  fun bothMapsToSystemAndLockFlags() {
    assertEquals(
      WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK,
      WallpaperTarget.parse("both").flags,
    )
  }

  @Test(expected = IllegalArgumentException::class)
  fun invalidTargetIsRejected() {
    WallpaperTarget.parse("desk")
  }

  @Test
  fun apiBelow24KeepsHomeAndRejectsLock() {
    val capabilities = WallpaperCapabilities(
      apiLevel = 23,
      isSetWallpaperAllowed = true,
      lockScreenSupported = true,
    )

    assertTrue(capabilities.supportsHome)
    assertFalse(capabilities.supportsLock)
  }

  @Test
  fun policyBlockDisablesAllTargets() {
    val capabilities = WallpaperCapabilities(
      apiLevel = 36,
      isSetWallpaperAllowed = false,
      lockScreenSupported = true,
    )

    assertFalse(capabilities.supportsHome)
    assertFalse(capabilities.supportsLock)
  }

  @Test
  fun unsupportedDeviceDoesNotAdvertiseHome() {
    val capabilities = WallpaperPlatformPolicy.capabilities(36, false, true)
    assertFalse(capabilities.supportsHome)
    assertFalse(capabilities.supportsLock)
  }

  @Test
  fun apiBelow24UsesLegacyHomeOnlyWithoutApi24Policy() {
    val capabilities = WallpaperPlatformPolicy.capabilities(23, true, false)
    assertTrue(capabilities.supportsHome)
    assertFalse(capabilities.supportsLock)
    assertTrue(WallpaperPlatformPolicy.usesLegacyHomeApply(23, WallpaperTarget.HOME))
    assertFalse(WallpaperPlatformPolicy.usesLegacyHomeApply(23, WallpaperTarget.LOCK))
  }

  @Test
  fun bitmapSafetyRejectsRgbaAllocationsOver64MiBWithoutOverflow() {
    assertTrue(WallpaperImageSafety.hasSafeRgbaAllocation(1080, 2400))
    assertFalse(WallpaperImageSafety.hasSafeRgbaAllocation(5000, 5000))
    assertFalse(WallpaperImageSafety.hasSafeRgbaAllocation(Int.MAX_VALUE, Int.MAX_VALUE))
  }
}
