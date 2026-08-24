package org.haina2410.motivana.wallpaper

interface RotationConfigurationStore {
  fun readSnapshot(catalog: RotationCatalog): RotationSnapshotResult
  fun readStatus(): RotationStatus
  /** Raw records let a failed configuration restore an invalid/legacy record byte-for-byte. */
  fun readRawSnapshot(): String?
  fun readRawStatus(): String?
  fun saveSnapshot(snapshot: RotationSnapshot): Boolean
  fun saveStatus(status: RotationStatus): Boolean
  fun restoreRawSnapshot(value: String?): Boolean
  fun restoreRawStatus(value: String?): Boolean
}

/** Makes native snapshot/status and confirmed unique-work scheduling converge, or restores prior state. */
class RotationConfigurationTransaction(private val store: RotationConfigurationStore, private val scheduler: RotationScheduler, private val clock: () -> Long) {
  fun apply(next: RotationSnapshot, catalog: RotationCatalog): Boolean {
    val oldSnapshot = store.readSnapshot(catalog).let { it as? RotationSnapshotResult.Valid }?.snapshot
    val oldSnapshotRaw = store.readRawSnapshot()
    val oldStatusRaw = store.readRawStatus()
    val oldStatus = store.readStatus()
    val mergedNext = next.copy(
      lastQuoteId = next.lastQuoteId ?: oldSnapshot?.lastQuoteId,
      lastPresetId = next.lastPresetId ?: oldSnapshot?.lastPresetId,
    )
    if (!store.saveSnapshot(mergedNext)) return false
    if (!scheduler.configure(mergedNext.enabled, mergedNext.intervalHours)) return restore(oldSnapshot, oldSnapshotRaw, oldStatusRaw)
    val nextStatus = RotationStatus(mergedNext.enabled, if (mergedNext.enabled) RotationState.SCHEDULED else RotationState.DISABLED, clock(), oldStatus.lastAppliedAt, oldStatus.quoteId, oldStatus.presetId)
    if (store.saveStatus(nextStatus)) return true
    return restore(oldSnapshot, oldSnapshotRaw, oldStatusRaw)
  }
  private fun restore(old: RotationSnapshot?, snapshotRaw: String?, statusRaw: String?): Boolean {
    val scheduleRestored = if (old == null) scheduler.configure(false, 6) else scheduler.configure(old.enabled, old.intervalHours)
    val snapshotRestored = store.restoreRawSnapshot(snapshotRaw)
    val statusRestored = store.restoreRawStatus(statusRaw)
    // A compensated operation is never reported as successfully configured.
    return scheduleRestored && snapshotRestored && statusRestored && false
  }
}
