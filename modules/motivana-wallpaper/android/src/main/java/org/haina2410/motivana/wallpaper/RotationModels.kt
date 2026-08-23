package org.haina2410.motivana.wallpaper

import org.json.JSONArray
import org.json.JSONObject

data class RotationQuote(val id: String, val text: String, val author: String?)
sealed class RotationBackground { data class Solid(val color: String) : RotationBackground(); data class Gradient(val start: String, val end: String, val angle: Double) : RotationBackground() }
data class RotationPreset(val id: String, val family: String, val weight: String, val align: String, val quotePositionY: Double, val preferredRatio: Double, val minimumRatio: Double, val lineHeight: Double, val textColor: String, val authorColor: String, val background: RotationBackground, val overlay: String? = null)
data class RotationCatalog(val quotes: List<RotationQuote>, val presets: List<RotationPreset>) {
  fun quote(id: String) = quotes.firstOrNull { it.id == id }
  fun preset(id: String) = presets.firstOrNull { it.id == id }
}
data class RotationSelection(val quote: RotationQuote, val preset: RotationPreset)
data class RotationSnapshot(val enabled: Boolean, val intervalHours: Int, val target: WallpaperTarget, val selectedPresetId: String, val randomizePreset: Boolean, val favoriteQuoteIds: List<String>, val favoriteQuotesOnly: Boolean, val lastQuoteId: String? = null, val lastPresetId: String? = null) {
  fun toJson() = JSONObject().apply {
    put("enabled", enabled); put("intervalHours", intervalHours); put("target", target.name.lowercase()); put("selectedPresetId", selectedPresetId); put("randomizePreset", randomizePreset); put("favoriteQuoteIds", JSONArray(favoriteQuoteIds)); put("favoriteQuotesOnly", favoriteQuotesOnly); putOpt("lastQuoteId", lastQuoteId); putOpt("lastPresetId", lastPresetId)
  }.toString()
  companion object {
    fun parse(value: String?, catalog: RotationCatalog): RotationSnapshotResult = try {
      val json = JSONObject(value ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION"))
      val favorites = json.optJSONArray("favoriteQuoteIds")?.let { a -> (0 until a.length()).mapNotNull { a.optString(it).takeIf(String::isNotBlank) }.distinct() } ?: emptyList()
      val snapshot = RotationSnapshot(json.optBoolean("enabled"), json.optInt("intervalHours"), WallpaperTarget.parse(json.optString("target")), json.optString("selectedPresetId"), json.optBoolean("randomizePreset"), favorites, json.optBoolean("favoriteQuotesOnly"), json.optString("lastQuoteId").takeIf(String::isNotBlank), json.optString("lastPresetId").takeIf(String::isNotBlank))
      when {
        snapshot.intervalHours !in setOf(6, 12, 24) -> RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
        catalog.preset(snapshot.selectedPresetId) == null -> RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
        favorites.any { catalog.quote(it) == null } -> RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
        snapshot.favoriteQuotesOnly && favorites.isEmpty() -> RotationSnapshotResult.Invalid("EMPTY_FAVORITES")
        else -> RotationSnapshotResult.Valid(snapshot)
      }
    } catch (_: Exception) { RotationSnapshotResult.Invalid("INVALID_CONFIGURATION") }
  }
}
sealed class RotationSnapshotResult { abstract val isValid: Boolean; data class Valid(val snapshot: RotationSnapshot) : RotationSnapshotResult() { override val isValid = true }; data class Invalid(val code: String) : RotationSnapshotResult() { override val isValid = false } }
data class RotationStatus(val enabled: Boolean, val state: String, val at: Long? = null, val quoteId: String? = null, val presetId: String? = null, val errorCode: String? = null) {
  fun toJson() = JSONObject().apply { put("enabled", enabled); put("state", state); putOpt("at", at); putOpt("quoteId", quoteId); putOpt("presetId", presetId); putOpt("errorCode", errorCode) }.toString()
  companion object { fun parse(value: String?) = try { val j = JSONObject(value ?: "{}"); RotationStatus(j.optBoolean("enabled"), j.optString("state", "disabled"), j.optLong("at").takeIf { it > 0 }, j.optString("quoteId").takeIf(String::isNotBlank), j.optString("presetId").takeIf(String::isNotBlank), j.optString("errorCode").takeIf(String::isNotBlank)) } catch (_: Exception) { RotationStatus(false, "disabled") } }
}
