package org.haina2410.motivana.wallpaper

import android.app.WallpaperManager

enum class WallpaperTarget(val flags: Int) {
  HOME(WallpaperManager.FLAG_SYSTEM),
  LOCK(WallpaperManager.FLAG_LOCK),
  BOTH(WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK),
  ;

  companion object {
    fun parse(value: String): WallpaperTarget = when (value) {
      "home" -> HOME
      "lock" -> LOCK
      "both" -> BOTH
      else -> throw IllegalArgumentException("Unsupported wallpaper target")
    }
  }
}
