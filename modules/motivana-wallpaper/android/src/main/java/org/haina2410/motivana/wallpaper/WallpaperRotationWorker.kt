package org.haina2410.motivana.wallpaper

import android.app.WallpaperManager
import android.content.Context
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class WallpaperRotationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    val preferences = RotationPreferences(applicationContext)
    val catalog = try { RotationCatalogLoader.load(applicationContext.assets) } catch (_: Exception) { preferences.saveStatus(RotationStatus(true, RotationState.FAILED, System.currentTimeMillis(), errorCode = "ASSET_FAILED")); return Result.failure() }
    val snapshot = preferences.snapshot(catalog)
    if (snapshot !is RotationSnapshotResult.Valid) { preferences.saveStatus(RotationStatus(false, RotationState.FAILED, System.currentTimeMillis(), errorCode = (snapshot as? RotationSnapshotResult.Invalid)?.code ?: "INVALID_CONFIGURATION")); return Result.failure() }
    if (!snapshot.snapshot.enabled) { preferences.saveStatus(RotationStatus(false, RotationState.DISABLED, System.currentTimeMillis())); return Result.failure() }
    val config = snapshot.snapshot
    preferences.saveStatus(RotationStatus(true, RotationState.RUNNING, System.currentTimeMillis()))
    val manager = WallpaperManager.getInstance(applicationContext); val capabilities = WallpaperPlatformPolicy.capabilities(Build.VERSION.SDK_INT, manager.isWallpaperSupported, if (Build.VERSION.SDK_INT >= 24) manager.isSetWallpaperAllowed else true)
    if (!capabilities.supports(config.target)) { preferences.saveStatus(RotationStatus(true, RotationState.FAILED, System.currentTimeMillis(), errorCode = "LOCK_UNSUPPORTED")); return Result.failure() }
    val selection = try { RotationSelector(java.util.Random()).select(catalog, if (config.favoriteQuotesOnly) config.favoriteQuoteIds else emptyList(), config.lastQuoteId, config.lastPresetId, config.randomizePreset, config.selectedPresetId) } catch (error: SelectionException) { preferences.saveStatus(RotationStatus(true, RotationState.FAILED, System.currentTimeMillis(), errorCode = error.code)); return Result.failure() }
    var bitmap: android.graphics.Bitmap? = null
    return try {
      val display = applicationContext.resources.displayMetrics
      bitmap = CanvasWallpaperRenderer(catalog, emptyMap(), applicationContext.assets).render(selection.quote, selection.preset, display.widthPixels, display.heightPixels)
      manager.setBitmap(bitmap, null, true, config.target.flags)
      preferences.saveSnapshot(config.copy(lastQuoteId = selection.quote.id, lastPresetId = selection.preset.id))
      preferences.saveStatus(RotationStatus(true, RotationState.SUCCEEDED, System.currentTimeMillis(), System.currentTimeMillis(), selection.quote.id, selection.preset.id))
      Result.success()
    } catch (_: OutOfMemoryError) { preferences.saveStatus(RotationStatus(true, RotationState.FAILED, System.currentTimeMillis(), errorCode = "RENDER_FAILED")); Result.retry() }
      catch (_: Exception) { preferences.saveStatus(RotationStatus(true, RotationState.FAILED, System.currentTimeMillis(), errorCode = "APPLY_FAILED")); Result.retry() }
      finally { bitmap?.recycle() }
  }
}
