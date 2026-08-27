package org.haina2410.motivana.wallpaper

import android.app.WallpaperManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.net.Uri
import androidx.work.WorkInfo
import androidx.work.WorkManager
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
      val catalog = try { RotationCatalogLoader.load(context.assets) } catch (e: CatalogException) {
        val code = if (e.code == "FONT_MISSING") "FONT_MISSING" else "ASSET_INVALID"
        throw WallpaperException(code, "Wallpaper rotation assets are invalid.")
      } catch (_: TransientRotationException) {
        throw WallpaperException("ASSET_IO", "Wallpaper rotation assets are temporarily unavailable.")
      } catch (_: Exception) {
        throw WallpaperException("ASSET_INVALID", "Wallpaper rotation assets are invalid.")
      }
      val snapshot = try { RotationConfigureDecoder.decode(options) } catch (_: Exception) { throw WallpaperException("INVALID_CONFIGURATION", "Wallpaper rotation preferences are invalid.") }
      val validated = RotationSnapshot.parse(snapshot.toJson(), catalog)
      if (validated !is RotationSnapshotResult.Valid) throw WallpaperException((validated as RotationSnapshotResult.Invalid).code, "Wallpaper rotation preferences are invalid.")
      val manager = WallpaperManager.getInstance(context)
      if (snapshot.enabled && !capabilities(manager).supports(snapshot.target)) throw WallpaperException("LOCK_UNSUPPORTED", "The selected wallpaper target is unsupported.")
      val preferences = RotationPreferences(context)
      val transaction = RotationConfigurationTransaction(object : RotationConfigurationStore {
        override fun readSnapshot(catalog: RotationCatalog) = preferences.snapshot(catalog)
        override fun readStatus() = preferences.status()
        override fun readRawSnapshot() = preferences.rawSnapshot()
        override fun readRawStatus() = preferences.rawStatus()
        override fun saveSnapshot(snapshot: RotationSnapshot) = preferences.saveSnapshot(snapshot)
        override fun saveStatus(status: RotationStatus) = preferences.saveStatus(status)
        override fun restoreRawSnapshot(value: String?) = preferences.restoreRawSnapshot(value)
        override fun restoreRawStatus(value: String?) = preferences.restoreRawStatus(value)
      }, RotationScheduler(AndroidRotationWorkScheduler(context)), System::currentTimeMillis)
      if (!transaction.apply(snapshot, catalog)) throw WallpaperException("CONFIGURE_FAILED", "Wallpaper rotation preferences could not be confirmed.")
    }
    AsyncFunction("getRotationStatus") {
      val preferences = RotationPreferences(context)
      val stored = preferences.status()
      val workState = runCatching { WorkManager.getInstance(context).getWorkInfosForUniqueWork(RotationScheduler.PERIODIC_NAME).get().firstOrNull()?.state }.getOrNull()
      val state = when (workState) { WorkInfo.State.RUNNING -> RotationState.RUNNING; WorkInfo.State.ENQUEUED, WorkInfo.State.BLOCKED -> if (stored.enabled) RotationState.SCHEDULED else stored.state; else -> stored.state }
      val snapshot = runCatching { RotationCatalogLoader.load(context.assets).let(preferences::snapshot).let { it as? RotationSnapshotResult.Valid }?.snapshot }.getOrNull()
      mapOf("enabled" to stored.enabled, "state" to state.name.lowercase(), "lastAppliedAt" to stored.lastAppliedAt, "lastQuoteId" to stored.quoteId, "lastPresetId" to stored.presetId, "errorCode" to stored.errorCode, "intervalHours" to snapshot?.intervalHours, "anchorHour" to snapshot?.anchorHour, "target" to snapshot?.target?.name?.lowercase())
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
