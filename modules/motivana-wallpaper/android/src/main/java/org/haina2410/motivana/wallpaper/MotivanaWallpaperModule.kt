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
      val capabilities = capabilities(manager)
      mapOf(
        "supportsHome" to capabilities.supportsHome,
        "supportsLock" to capabilities.supportsLock,
      )
    }

    AsyncFunction("setWallpaper") { uriString: String, targetValue: String ->
      val target = try {
        WallpaperTarget.parse(targetValue)
      } catch (_: IllegalArgumentException) {
        throw WallpaperException("INVALID_TARGET", "Wallpaper target is invalid.")
      }
      val manager = WallpaperManager.getInstance(context)
      val capabilities = capabilities(manager)
      if (!capabilities.isSetWallpaperAllowed) {
        throw WallpaperException("WALLPAPER_NOT_ALLOWED", "Wallpaper changes are not allowed.")
      }
      if (!capabilities.supports(target)) {
        throw WallpaperException("LOCK_UNSUPPORTED", "The selected wallpaper target is unsupported.")
      }
      val file = resolveExportFile(uriString)
      val bitmap = decodeWallpaper(file)
      try {
        if (WallpaperPlatformPolicy.usesLegacyHomeApply(Build.VERSION.SDK_INT, target)) {
          manager.setBitmap(bitmap)
        } else {
          manager.setBitmap(bitmap, null, true, target.flags)
        }
      } catch (_: Exception) {
        throw WallpaperException("APPLY_FAILED", "Wallpaper could not be applied.")
      } finally {
        bitmap.recycle()
      }
    }

    AsyncFunction("configureRotation") { options: Map<String, Any?> ->
      val catalog = try { RotationCatalogLoader.load(context.assets) } catch (_: Exception) { throw WallpaperException("ASSET_FAILED", "Wallpaper rotation assets are unavailable.") }
      val snapshot = try {
        RotationSnapshot(
          options["enabled"] as? Boolean ?: false,
          (options["intervalHours"] as? Number)?.toInt() ?: 0,
          WallpaperTarget.parse(options["target"] as? String ?: ""),
          options["selectedPresetId"] as? String ?: "",
          options["randomizePreset"] as? Boolean ?: false,
          (options["favoriteQuoteIds"] as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
          options["favoriteQuotesOnly"] as? Boolean ?: false,
        )
      } catch (_: Exception) { throw WallpaperException("INVALID_CONFIGURATION", "Wallpaper rotation preferences are invalid.") }
      val validated = RotationSnapshot.parse(snapshot.toJson(), catalog)
      if (validated !is RotationSnapshotResult.Valid) throw WallpaperException((validated as RotationSnapshotResult.Invalid).code, "Wallpaper rotation preferences are invalid.")
      val manager = WallpaperManager.getInstance(context)
      if (snapshot.enabled && !capabilities(manager).supports(snapshot.target)) throw WallpaperException("LOCK_UNSUPPORTED", "The selected wallpaper target is unsupported.")
      val preferences = RotationPreferences(context)
      if (!preferences.saveSnapshot(snapshot)) throw WallpaperException("CONFIGURE_FAILED", "Wallpaper rotation preferences could not be saved.")
      val scheduler = RotationScheduler(AndroidRotationWorkScheduler(context))
      scheduler.configure(snapshot.enabled, snapshot.intervalHours)
      preferences.saveStatus(RotationStatus(snapshot.enabled, if (snapshot.enabled) RotationState.SCHEDULED else RotationState.DISABLED, System.currentTimeMillis()))
    }
    AsyncFunction("getRotationStatus") {
      val status = RotationPreferences(context).status()
      mapOf("enabled" to status.enabled, "state" to status.state.name.lowercase(), "lastAppliedAt" to status.lastAppliedAt, "lastQuoteId" to status.quoteId, "lastPresetId" to status.presetId, "errorCode" to status.errorCode)
    }
    AsyncFunction("runRotationNow") {
      if (!BuildConfig.DEBUG) throw WallpaperException("DEBUG_ONLY", "Run rotation now is available in debug builds only.")
      val result = RotationScheduler(AndroidRotationWorkScheduler(context)).runNow(true)
      if (result != null) throw WallpaperException(result, "Run rotation now is unavailable.")
    }
  }

  private fun capabilities(manager: WallpaperManager): WallpaperCapabilities {
    val apiLevel = Build.VERSION.SDK_INT
    val wallpaperSupported = manager.isWallpaperSupported
    val setWallpaperAllowed = if (apiLevel >= 24) manager.isSetWallpaperAllowed else true
    return WallpaperPlatformPolicy.capabilities(apiLevel, wallpaperSupported, setWallpaperAllowed)
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
