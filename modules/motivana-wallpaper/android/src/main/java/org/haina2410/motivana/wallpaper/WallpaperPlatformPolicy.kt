package org.haina2410.motivana.wallpaper

object WallpaperPlatformPolicy {
  fun capabilities(
    apiLevel: Int,
    wallpaperSupported: Boolean,
    setWallpaperAllowed: Boolean,
  ): WallpaperCapabilities = WallpaperCapabilities(
    apiLevel = apiLevel,
    wallpaperSupported = wallpaperSupported,
    isSetWallpaperAllowed = wallpaperSupported && (apiLevel < 24 || setWallpaperAllowed),
    lockScreenSupported = apiLevel >= 24 && wallpaperSupported,
  )

  fun usesLegacyHomeApply(apiLevel: Int, target: WallpaperTarget): Boolean =
    apiLevel < 24 && target == WallpaperTarget.HOME
}
