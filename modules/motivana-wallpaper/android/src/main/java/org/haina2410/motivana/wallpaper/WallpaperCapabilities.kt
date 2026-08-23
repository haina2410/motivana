package org.haina2410.motivana.wallpaper

data class WallpaperCapabilities(
  val apiLevel: Int,
  val isSetWallpaperAllowed: Boolean,
  val lockScreenSupported: Boolean,
  val wallpaperSupported: Boolean = true,
) {
  val supportsHome: Boolean
    get() = wallpaperSupported && isSetWallpaperAllowed
  val supportsLock: Boolean
    get() = apiLevel >= 24 && isSetWallpaperAllowed && lockScreenSupported

  fun supports(target: WallpaperTarget): Boolean = when (target) {
    WallpaperTarget.HOME -> supportsHome
    WallpaperTarget.LOCK, WallpaperTarget.BOTH -> supportsLock
  }
}
