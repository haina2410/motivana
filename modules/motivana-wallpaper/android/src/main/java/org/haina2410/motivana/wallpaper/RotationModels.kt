package org.haina2410.motivana.wallpaper


data class RotationQuote(val id: String, val text: String, val author: String?)
sealed class RotationBackground { data class Solid(val color: String) : RotationBackground(); data class Gradient(val start: String, val end: String, val angle: Double) : RotationBackground() }
data class RotationPreset(val id: String, val family: String, val weight: String, val align: String, val quotePositionY: Double, val preferredRatio: Double, val minimumRatio: Double, val lineHeight: Double, val textColor: String, val authorColor: String, val background: RotationBackground, val overlay: String? = null)
data class RotationCatalog(val quotes: List<RotationQuote>, val presets: List<RotationPreset>) {
  fun quote(id: String) = quotes.firstOrNull { it.id == id }
  fun preset(id: String) = presets.firstOrNull { it.id == id }
}
data class RotationSelection(val quote: RotationQuote, val preset: RotationPreset)
class SelectionException(val code: String) : IllegalStateException(code)
enum class RotationState { DISABLED, SCHEDULED, RUNNING, SUCCEEDED, FAILED; companion object { fun parse(value: String) = entries.firstOrNull { it.name.equals(value, true) } } }
data class RotationSnapshot(val enabled: Boolean, val intervalHours: Int, val target: WallpaperTarget, val selectedPresetId: String, val randomizePreset: Boolean, val favoriteQuoteIds: List<String>, val favoriteQuotesOnly: Boolean, val lastQuoteId: String? = null, val lastPresetId: String? = null) {
  fun toJson() = """{"enabled":$enabled,"intervalHours":$intervalHours,"target":"${target.name.lowercase()}","selectedPresetId":"$selectedPresetId","randomizePreset":$randomizePreset,"favoriteQuoteIds":[${favoriteQuoteIds.joinToString(",") { "\"$it\"" }}],"favoriteQuotesOnly":$favoriteQuotesOnly${lastQuoteId?.let { ",\"lastQuoteId\":\"$it\"" } ?: ""}${lastPresetId?.let { ",\"lastPresetId\":\"$it\"" } ?: ""}}"""
  companion object {
    private val required = setOf("enabled", "intervalHours", "target", "selectedPresetId", "randomizePreset", "favoriteQuoteIds", "favoriteQuotesOnly")
    fun parse(value: String?, catalog: RotationCatalog): RotationSnapshotResult {
      if (value == null) return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      return try {
      if (!required.all { value.contains("\"$it\"") }) return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val enabled = jsonBoolean(value, "enabled") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val randomize = jsonBoolean(value, "randomizePreset") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val favoritesOnly = jsonBoolean(value, "favoriteQuotesOnly") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val interval = jsonInt(value, "intervalHours") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val targetValue = jsonString(value, "target") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val preset = jsonString(value, "selectedPresetId") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val favorites = jsonArray(value, "favoriteQuoteIds") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      if (favorites.distinct().size != favorites.size) return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val snapshot = RotationSnapshot(enabled, interval, WallpaperTarget.parse(targetValue), preset, randomize, favorites, favoritesOnly, jsonString(value, "lastQuoteId"), jsonString(value, "lastPresetId"))
      when {
        snapshot.intervalHours !in setOf(6, 12, 24) -> RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
        catalog.preset(snapshot.selectedPresetId) == null -> RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
        favorites.any { catalog.quote(it) == null } || snapshot.lastQuoteId?.let { catalog.quote(it) == null } == true || snapshot.lastPresetId?.let { catalog.preset(it) == null } == true -> RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
        snapshot.favoriteQuotesOnly && favorites.isEmpty() -> RotationSnapshotResult.Invalid("EMPTY_FAVORITES")
        else -> RotationSnapshotResult.Valid(snapshot)
      }
      } catch (_: Exception) { RotationSnapshotResult.Invalid("INVALID_CONFIGURATION") }
    }
  }
}
sealed class RotationSnapshotResult { abstract val isValid: Boolean; data class Valid(val snapshot: RotationSnapshot) : RotationSnapshotResult() { override val isValid = true }; data class Invalid(val code: String) : RotationSnapshotResult() { override val isValid = false } }
data class RotationStatus(val enabled: Boolean, val state: RotationState, val statusUpdatedAt: Long? = null, val lastAppliedAt: Long? = null, val quoteId: String? = null, val presetId: String? = null, val errorCode: String? = null) {
  fun toJson() = """{"enabled":$enabled,"state":"${state.name.lowercase()}"${statusUpdatedAt?.let { ",\"statusUpdatedAt\":$it" } ?: ""}${lastAppliedAt?.let { ",\"lastAppliedAt\":$it" } ?: ""}${quoteId?.let { ",\"quoteId\":\"$it\"" } ?: ""}${presetId?.let { ",\"presetId\":\"$it\"" } ?: ""}${errorCode?.let { ",\"errorCode\":\"$it\"" } ?: ""}}"""
  companion object { fun parse(value: String?): RotationStatus { if (value == null) return RotationStatus(false, RotationState.DISABLED); val enabled = jsonBoolean(value, "enabled") ?: return RotationStatus(false, RotationState.DISABLED); val state = jsonString(value, "state")?.let(RotationState::parse) ?: return RotationStatus(false, RotationState.DISABLED); return RotationStatus(enabled, state, jsonInt(value, "statusUpdatedAt")?.toLong(), jsonInt(value, "lastAppliedAt")?.toLong(), jsonString(value, "quoteId"), jsonString(value, "presetId"), jsonString(value, "errorCode")) } }
}

private fun jsonString(json: String, key: String): String? = Regex("\\\"${Regex.escape(key)}\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"").find(json)?.groupValues?.get(1)
private fun jsonInt(json: String, key: String): Int? = Regex("\\\"${Regex.escape(key)}\\\"\\s*:\\s*(\\d+)").find(json)?.groupValues?.get(1)?.toIntOrNull()
private fun jsonBoolean(json: String, key: String): Boolean? = Regex("\\\"${Regex.escape(key)}\\\"\\s*:\\s*(true|false)").find(json)?.groupValues?.get(1)?.toBooleanStrictOrNull()
private fun jsonArray(json: String, key: String): List<String>? = Regex("\\\"${Regex.escape(key)}\\\"\\s*:\\s*\\[([^]]*)]").find(json)?.groupValues?.get(1)?.let { raw -> if (raw.isBlank()) emptyList() else raw.split(',').map { it.trim().removePrefix("\"").removeSuffix("\"") }.takeIf { values -> values.all(String::isNotBlank) } }
