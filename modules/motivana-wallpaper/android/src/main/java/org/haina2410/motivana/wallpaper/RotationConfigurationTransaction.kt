package org.haina2410.motivana.wallpaper

interface RotationConfigurationStore {
  fun readSnapshot(catalog: RotationCatalog): RotationSnapshotResult
  fun readStatus(): RotationStatus
  fun saveSnapshot(snapshot: RotationSnapshot): Boolean
  fun saveStatus(status: RotationStatus): Boolean
}

/** Makes native snapshot/status and confirmed unique-work scheduling converge, or restores prior state. */
class RotationConfigurationTransaction(private val store: RotationConfigurationStore, private val scheduler: RotationScheduler, private val clock: () -> Long) {
  fun apply(next: RotationSnapshot, catalog: RotationCatalog): Boolean {
    val oldSnapshot = store.readSnapshot(catalog).let { it as? RotationSnapshotResult.Valid }?.snapshot
    val oldStatus = store.readStatus()
    if (!store.saveSnapshot(next)) return false
    if (!scheduler.configure(next.enabled, next.intervalHours)) return restore(oldSnapshot, oldStatus)
    val nextStatus = RotationStatus(next.enabled, if (next.enabled) RotationState.SCHEDULED else RotationState.DISABLED, clock(), oldStatus.lastAppliedAt, oldStatus.quoteId, oldStatus.presetId)
    if (store.saveStatus(nextStatus)) return true
    return restore(oldSnapshot, oldStatus)
  }
  private fun restore(old: RotationSnapshot?, status: RotationStatus): Boolean {
    val scheduleRestored = if (old == null) scheduler.configure(false, 6) else scheduler.configure(old.enabled, old.intervalHours)
    val snapshotRestored = old?.let(store::saveSnapshot) ?: true
    return scheduleRestored && snapshotRestored && store.saveStatus(status) && false
  }
}
