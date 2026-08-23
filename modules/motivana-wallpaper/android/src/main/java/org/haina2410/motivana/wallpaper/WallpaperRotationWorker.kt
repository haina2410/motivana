package org.haina2410.motivana.wallpaper

import android.app.WallpaperManager
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

private class AndroidRotationBitmap(val bitmap: Bitmap) : RotationBitmap { override fun recycle() = bitmap.recycle() }
fun interface RotationWorkerExecution { fun run(): RotationWorkResult }
object WallpaperRotationWorkerFactory {
  /** Test seam injects the same catalog/store/selector/renderer/applier pipeline used by doWork. */
  @Volatile var testPipelineFactory: ((Context) -> RotationPipeline)? = null
  @Volatile var testExecution: (() -> RotationWorkerExecution)? = null
  fun create(context: Context): RotationWorkerExecution = testExecution?.invoke()
    ?: testPipelineFactory?.let { factory -> RotationWorkerExecution { factory(context).run() } }
    ?: default(context)
  private fun default(context: Context): RotationWorkerExecution {
    val preferences = RotationPreferences(context)
    val catalog = try { RotationCatalogLoader.load(context.assets) } catch (e: CatalogException) {
      val code = if (e.code == "FONT_MISSING") "FONT_MISSING" else "ASSET_INVALID"
      return RotationWorkerExecution { if (preferences.saveStatus(RotationStatus(false, RotationState.FAILED, System.currentTimeMillis(), errorCode = code))) RotationWorkResult.FAILURE else RotationWorkResult.RETRY }
    } catch (_: TransientRotationException) {
      return RotationWorkerExecution { if (preferences.saveStatus(RotationStatus(false, RotationState.FAILED, System.currentTimeMillis(), errorCode = "ASSET_IO"))) RotationWorkResult.RETRY else RotationWorkResult.RETRY }
    } catch (_: Exception) {
      return RotationWorkerExecution { if (preferences.saveStatus(RotationStatus(false, RotationState.FAILED, System.currentTimeMillis(), errorCode = "ASSET_INVALID"))) RotationWorkResult.FAILURE else RotationWorkResult.RETRY }
    }
    val manager = WallpaperManager.getInstance(context)
    val policy = WallpaperPlatformPolicy.capabilities(Build.VERSION.SDK_INT, manager.isWallpaperSupported, if (Build.VERSION.SDK_INT >= 24) manager.isSetWallpaperAllowed else true)
    return RotationWorkerExecution { RotationPipeline(
      catalog = catalog,
      store = object : RotationSnapshotStore { override fun read(catalog: RotationCatalog) = preferences.snapshot(catalog); override fun saveSnapshot(snapshot: RotationSnapshot) = preferences.saveSnapshot(snapshot); override fun saveStatus(status: RotationStatus) = preferences.saveStatus(status) },
      selector = RotationSelector(java.util.Random()),
      renderer = object : RotationRenderer { override fun render(quote: RotationQuote, preset: RotationPreset): RotationBitmap { val display = context.resources.displayMetrics; return AndroidRotationBitmap(CanvasWallpaperRenderer(catalog, emptyMap(), context.assets).render(quote, preset, display.widthPixels, display.heightPixels)) } },
      applier = object : RotationApplier { override fun apply(bitmap: RotationBitmap, target: WallpaperTarget) { if (!policy.supports(target)) throw PermanentRotationException("LOCK_UNSUPPORTED"); val value = (bitmap as? AndroidRotationBitmap)?.bitmap ?: throw PermanentRotationException("RENDER_FAILED"); try { if (Build.VERSION.SDK_INT < 24 && target == WallpaperTarget.HOME) manager.setBitmap(value) else if (Build.VERSION.SDK_INT >= 24) manager.setBitmap(value, null, true, target.flags) else throw PermanentRotationException("LOCK_UNSUPPORTED") } catch (e: PermanentRotationException) { throw e } catch (_: Exception) { throw TransientRotationException("SYSTEM_FAILED") } } },
      clock = System::currentTimeMillis,
    ).run() }
  }
}

class WallpaperRotationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    return when (WallpaperRotationWorkerFactory.create(applicationContext).run()) { RotationWorkResult.SUCCESS -> Result.success(); RotationWorkResult.RETRY -> Result.retry(); RotationWorkResult.FAILURE -> Result.failure() }
  }
}
