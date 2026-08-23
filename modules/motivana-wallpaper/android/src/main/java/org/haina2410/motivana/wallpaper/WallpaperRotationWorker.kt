package org.haina2410.motivana.wallpaper

import android.app.WallpaperManager
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

private class AndroidRotationBitmap(val bitmap: Bitmap) : RotationBitmap { override fun recycle() = bitmap.recycle() }

class WallpaperRotationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    val preferences = RotationPreferences(applicationContext)
    val catalog = try { RotationCatalogLoader.load(applicationContext.assets) } catch (_: Exception) {
      preferences.saveStatus(RotationStatus(false, RotationState.FAILED, System.currentTimeMillis(), errorCode = "ASSET_FAILED"))
      return Result.failure()
    }
    val manager = WallpaperManager.getInstance(applicationContext)
    val policy = WallpaperPlatformPolicy.capabilities(Build.VERSION.SDK_INT, manager.isWallpaperSupported, if (Build.VERSION.SDK_INT >= 24) manager.isSetWallpaperAllowed else true)
    val pipeline = RotationPipeline(
      catalog = catalog,
      store = object : RotationSnapshotStore {
        override fun read(catalog: RotationCatalog) = preferences.snapshot(catalog)
        override fun saveSnapshot(snapshot: RotationSnapshot) = preferences.saveSnapshot(snapshot)
        override fun saveStatus(status: RotationStatus) = preferences.saveStatus(status)
      },
      selector = RotationSelector(java.util.Random()),
      renderer = object : RotationRenderer {
        override fun render(quote: RotationQuote, preset: RotationPreset): RotationBitmap {
          val display = applicationContext.resources.displayMetrics
          return AndroidRotationBitmap(CanvasWallpaperRenderer(catalog, emptyMap(), applicationContext.assets).render(quote, preset, display.widthPixels, display.heightPixels))
        }
      },
      applier = object : RotationApplier {
        override fun apply(bitmap: RotationBitmap, target: WallpaperTarget) {
          if (!policy.supports(target)) throw PermanentRotationException("LOCK_UNSUPPORTED")
          val value = (bitmap as? AndroidRotationBitmap)?.bitmap ?: throw PermanentRotationException("RENDER_FAILED")
          try {
            if (Build.VERSION.SDK_INT < 24 && target == WallpaperTarget.HOME) manager.setBitmap(value)
            else if (Build.VERSION.SDK_INT >= 24) manager.setBitmap(value, null, true, target.flags)
            else throw PermanentRotationException("LOCK_UNSUPPORTED")
          } catch (e: PermanentRotationException) { throw e } catch (_: Exception) { throw TransientRotationException("SYSTEM_FAILED") }
        }
      },
      clock = System::currentTimeMillis,
    )
    return when (pipeline.run()) { RotationWorkResult.SUCCESS -> Result.success(); RotationWorkResult.RETRY -> Result.retry(); RotationWorkResult.FAILURE -> Result.failure() }
  }
}
