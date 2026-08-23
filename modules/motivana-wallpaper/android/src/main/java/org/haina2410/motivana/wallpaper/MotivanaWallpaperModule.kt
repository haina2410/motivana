package org.haina2410.motivana.wallpaper

import android.app.WallpaperManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private class WallpaperException(code: String, message: String) : CodedException(code, message, null)

class MotivanaWallpaperModule : Module() {
  private val context
    get() = appContext.reactContext
      ?: throw WallpaperException("APPLY_FAILED", "Wallpaper context is unavailable.")

  override fun definition() = ModuleDefinition {
    Name("MotivanaWallpaper")

    AsyncFunction("getCapabilities") {
      val manager = WallpaperManager.getInstance(context)
      val capabilities = WallpaperCapabilities(
        apiLevel = Build.VERSION.SDK_INT,
        isSetWallpaperAllowed = manager.isSetWallpaperAllowed,
        lockScreenSupported = manager.isWallpaperSupported,
      )
      mapOf(
        "supportsHome" to capabilities.supportsHome,
        "supportsLock" to capabilities.supportsLock,
      )
    }

    AsyncFunction("setWallpaper") { uriString: String, targetValue: String ->
      val target = try {
        WallpaperTarget.parse(targetValue)
      } catch (_: IllegalArgumentException) {
        throw WallpaperException("APPLY_FAILED", "Wallpaper target is invalid.")
      }
      val manager = WallpaperManager.getInstance(context)
      val capabilities = WallpaperCapabilities(
        apiLevel = Build.VERSION.SDK_INT,
        isSetWallpaperAllowed = manager.isSetWallpaperAllowed,
        lockScreenSupported = manager.isWallpaperSupported,
      )
      if (!capabilities.isSetWallpaperAllowed) {
        throw WallpaperException("WALLPAPER_NOT_ALLOWED", "Wallpaper changes are not allowed.")
      }
      if (!capabilities.supports(target)) {
        throw WallpaperException("LOCK_UNSUPPORTED", "The selected wallpaper target is unsupported.")
      }
      val file = resolveExportFile(uriString)
      val bitmap = decodeWallpaper(file)
      try {
        manager.setBitmap(bitmap, null, true, target.flags)
      } catch (_: Exception) {
        throw WallpaperException("APPLY_FAILED", "Wallpaper could not be applied.")
      } finally {
        bitmap.recycle()
      }
    }

    AsyncFunction("configureRotation") { _: Map<String, Any?> ->
      rotationUnavailable()
    }
    AsyncFunction("getRotationStatus") {
      rotationUnavailable()
    }
    AsyncFunction("runRotationNow") {
      rotationUnavailable()
    }
  }

  private fun rotationUnavailable(): Unit {
    throw WallpaperException("NOT_IMPLEMENTED", "Wallpaper rotation is not available yet.")
  }

  private fun resolveExportFile(uriString: String): File {
    val uri = Uri.parse(uriString)
    if (uri.scheme != "file" || uri.path.isNullOrBlank()) {
      throw WallpaperException("FILE_NOT_FOUND", "Wallpaper export was not found.")
    }
    val file = File(uri.path!!).canonicalFile
    val exportsDirectory = File(context.cacheDir, "motivana-exports").canonicalFile
    if (!file.isFile || !file.path.startsWith("${exportsDirectory.path}${File.separator}")) {
      throw WallpaperException("FILE_NOT_FOUND", "Wallpaper export was not found.")
    }
    return file
  }

  private fun decodeWallpaper(file: File): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw WallpaperException("DECODE_FAILED", "Wallpaper export could not be decoded.")
    }
    if (!WallpaperImageSafety.hasSafeRgbaAllocation(bounds.outWidth, bounds.outHeight)) {
      throw WallpaperException("DECODE_FAILED", "Wallpaper export is too large.")
    }
    return BitmapFactory.decodeFile(file.path)
      ?: throw WallpaperException("DECODE_FAILED", "Wallpaper export could not be decoded.")
  }
}
