package org.haina2410.motivana.wallpaper

interface RotationSnapshotStore { fun read(catalog: RotationCatalog): RotationSnapshotResult; fun saveSnapshot(snapshot: RotationSnapshot): Boolean; fun saveStatus(status: RotationStatus): Boolean }
interface RotationBitmap { fun recycle() }
interface RotationRenderer { fun render(quote: RotationQuote, preset: RotationPreset): RotationBitmap }
interface RotationApplier { fun apply(bitmap: RotationBitmap, target: WallpaperTarget) }
class TransientRotationException(code: String) : RuntimeException(code)

class RotationPipeline(
  private val catalog: RotationCatalog,
  private val store: RotationSnapshotStore,
  private val selector: RotationSelector,
  private val renderer: RotationRenderer,
  private val applier: RotationApplier,
  private val clock: () -> Long,
) {
  fun run(): RotationWorkResult {
    val parsed = store.read(catalog)
    if (parsed !is RotationSnapshotResult.Valid) return record(false, RotationState.FAILED, (parsed as RotationSnapshotResult.Invalid).code, RotationWorkResult.FAILURE)
    val snapshot = parsed.snapshot
    if (!snapshot.enabled) return record(false, RotationState.DISABLED, null, RotationWorkResult.FAILURE)
    if (!store.saveStatus(RotationStatus(true, RotationState.RUNNING, clock()))) return RotationWorkResult.RETRY
    val selection = try { selector.select(catalog, if (snapshot.favoriteQuotesOnly) snapshot.favoriteQuoteIds else emptyList(), snapshot.lastQuoteId, snapshot.lastPresetId, snapshot.randomizePreset, snapshot.selectedPresetId) } catch (e: SelectionException) { return record(true, RotationState.FAILED, e.code, RotationWorkResult.FAILURE) }
    var bitmap: RotationBitmap? = null
    return try {
      bitmap = renderer.render(selection.quote, selection.preset)
      applier.apply(bitmap, snapshot.target)
      val now = clock()
      if (!store.saveSnapshot(snapshot.copy(lastQuoteId = selection.quote.id, lastPresetId = selection.preset.id)) || !store.saveStatus(RotationStatus(true, RotationState.SUCCEEDED, now, now, selection.quote.id, selection.preset.id))) RotationWorkResult.RETRY else RotationWorkResult.SUCCESS
    } catch (_: TransientRotationException) { record(true, RotationState.FAILED, "SYSTEM_FAILED", RotationWorkResult.RETRY) }
      catch (_: OutOfMemoryError) { record(true, RotationState.FAILED, "RENDER_FAILED", RotationWorkResult.RETRY) }
      catch (_: Exception) { record(true, RotationState.FAILED, "APPLY_FAILED", RotationWorkResult.RETRY) }
      finally { bitmap?.recycle() }
  }
  private fun record(enabled: Boolean, state: RotationState, code: String?, result: RotationWorkResult): RotationWorkResult { store.saveStatus(RotationStatus(enabled, state, clock(), errorCode = code)); return result }
}
enum class RotationWorkResult { SUCCESS, RETRY, FAILURE }
