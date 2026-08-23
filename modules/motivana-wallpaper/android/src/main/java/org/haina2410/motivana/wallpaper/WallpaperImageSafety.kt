package org.haina2410.motivana.wallpaper

object WallpaperImageSafety {
  private const val MAXIMUM_RGBA_BYTES = 64L * 1024L * 1024L

  fun hasSafeRgbaAllocation(width: Int, height: Int): Boolean {
    if (width <= 0 || height <= 0) return false
    val rgbaBytes = width.toLong() * height.toLong() * 4L
    return rgbaBytes > 0L && rgbaBytes <= MAXIMUM_RGBA_BYTES
  }
}
