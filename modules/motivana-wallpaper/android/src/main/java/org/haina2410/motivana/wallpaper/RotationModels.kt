package org.haina2410.motivana.wallpaper

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

data class RotationQuote(val id: String, val text: String, val author: String?, val category: String = "")
object RotationLocales {
  const val DEFAULT = "en"
  val supported = setOf("en", "vi")
}
data class RotationQuoteEntry(
  val id: String,
  val text: Map<String, String>,
  val sourceLocale: String,
  val author: String?,
  val category: String = "",
) {
  /** Mirrors favoriteQuoteText in the JS repository: the chosen language, else the original. */
  fun resolve(locale: String) = RotationQuote(id, text[locale] ?: text.getValue(sourceLocale), author, category)
  fun hasLocale(locale: String) = text.containsKey(locale)
}
sealed class RotationBackground { data class Solid(val color: String) : RotationBackground(); data class Gradient(val start: String, val end: String, val angle: Double) : RotationBackground() }
data class RotationPreset(val id: String, val family: String, val weight: String, val align: String, val quotePositionY: Double, val preferredRatio: Double, val minimumRatio: Double, val lineHeight: Double, val textColor: String, val authorColor: String, val background: RotationBackground, val overlay: String? = null)
data class RotationCatalog(val quotes: List<RotationQuoteEntry>, val presets: List<RotationPreset>) {
  fun quote(id: String) = quotes.firstOrNull { it.id == id }
  fun preset(id: String) = presets.firstOrNull { it.id == id }
}
data class RotationSelection(val quote: RotationQuote, val preset: RotationPreset)
class SelectionException(val code: String) : IllegalStateException(code)
enum class RotationState { DISABLED, SCHEDULED, RUNNING, SUCCEEDED, FAILED; companion object { fun parse(value: String) = entries.firstOrNull { it.name.equals(value, true) } } }
data class RotationSnapshot(val enabled: Boolean, val intervalHours: Int, val target: WallpaperTarget, val selectedPresetId: String, val randomizePreset: Boolean, val favoriteQuoteIds: List<String>, val favoriteQuotesOnly: Boolean, val lastQuoteId: String? = null, val lastPresetId: String? = null, val contentLocale: String = RotationLocales.DEFAULT) {
  fun toJson() = """{"enabled":$enabled,"intervalHours":$intervalHours,"target":"${target.name.lowercase()}","selectedPresetId":"$selectedPresetId","randomizePreset":$randomizePreset,"favoriteQuoteIds":[${favoriteQuoteIds.joinToString(",") { "\"$it\"" }}],"favoriteQuotesOnly":$favoriteQuotesOnly,"contentLocale":"$contentLocale"${lastQuoteId?.let { ",\"lastQuoteId\":\"$it\"" } ?: ""}${lastPresetId?.let { ",\"lastPresetId\":\"$it\"" } ?: ""}}"""
  companion object {
    private val required = setOf("enabled", "intervalHours", "target", "selectedPresetId", "randomizePreset", "favoriteQuoteIds", "favoriteQuotesOnly")
    fun parse(value: String?, catalog: RotationCatalog): RotationSnapshotResult {
      if (value == null) return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      return try {
      val json = strictObject(value)
      if (!required.all(json::has)) return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val enabled = json.requiredBoolean("enabled") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val randomize = json.requiredBoolean("randomizePreset") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val favoritesOnly = json.requiredBoolean("favoriteQuotesOnly") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val interval = json.requiredExactInt("intervalHours") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val targetValue = json.requiredString("target") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val preset = json.requiredString("selectedPresetId") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      val favorites = json.requiredStringArray("favoriteQuoteIds") ?: return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      if (favorites.distinct().size != favorites.size) return RotationSnapshotResult.Invalid("INVALID_CONFIGURATION")
      // contentLocale stays optional. Snapshots that the shipped app already saved have
      // no such key. A required key would stop rotation for every user after an upgrade.
      val locale = json.optionalString("contentLocale")?.takeIf { it in RotationLocales.supported } ?: RotationLocales.DEFAULT
      val snapshot = RotationSnapshot(enabled, interval, WallpaperTarget.parse(targetValue), preset, randomize, favorites, favoritesOnly, json.optionalString("lastQuoteId"), json.optionalString("lastPresetId"), locale)
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
  companion object {
    private val errors = setOf("INVALID_CONFIGURATION", "EMPTY_FAVORITES", "LOCK_UNSUPPORTED", "FONT_MISSING", "ASSET_INVALID", "ASSET_IO", "SYSTEM_FAILED", "RENDER_FAILED", "APPLY_FAILED", "NO_ELIGIBLE_QUOTES")
    fun parse(value: String?): RotationStatus { return try {
      if (value == null) return RotationStatus(false, RotationState.DISABLED)
      val json = strictObject(value)
      val enabled = json.requiredBoolean("enabled") ?: return RotationStatus(false, RotationState.DISABLED)
      val state = json.requiredString("state")?.let(RotationState::parse) ?: return RotationStatus(false, RotationState.DISABLED)
      val error = json.optionalString("errorCode")?.takeIf { it in errors } ?: if (json.has("errorCode") && !json.isNull("errorCode")) return RotationStatus(false, RotationState.DISABLED) else null
      RotationStatus(enabled, state, json.optionalLong("statusUpdatedAt"), json.optionalLong("lastAppliedAt"), json.optionalString("quoteId"), json.optionalString("presetId"), error)
    } catch (_: Exception) { RotationStatus(false, RotationState.DISABLED) } }
  }
}

private fun JSONObject.requiredString(key: String): String? = if (has(key) && !isNull(key) && get(key) is String) getString(key).takeIf(String::isNotBlank) else null
private fun strictObject(value: String): JSONObject { val tokener = JSONTokener(value); val parsed = tokener.nextValue() as? JSONObject ?: throw IllegalArgumentException("object required"); if (tokener.nextClean().code != 0) throw IllegalArgumentException("trailing JSON"); return parsed }
private fun JSONObject.optionalString(key: String): String? = if (!has(key) || isNull(key)) null else (get(key) as? String)?.takeIf(String::isNotBlank)
private fun JSONObject.requiredBoolean(key: String): Boolean? = if (has(key) && get(key) is Boolean) getBoolean(key) else null
private fun JSONObject.requiredExactInt(key: String): Int? { val value = if (has(key)) get(key) else return null; return (value as? Number)?.let { number -> val long = number.toLong(); if (number.toDouble() == long.toDouble() && long in Int.MIN_VALUE..Int.MAX_VALUE) long.toInt() else null } }
private fun JSONObject.optionalLong(key: String): Long? { if (!has(key) || isNull(key)) return null; val value = get(key) as? Number ?: return null; val long = value.toLong(); return long.takeIf { value.toDouble() == it.toDouble() } }
private fun JSONObject.requiredStringArray(key: String): List<String>? { val array = if (has(key) && get(key) is JSONArray) getJSONArray(key) else return null; return (0 until array.length()).map { index -> array.opt(index) as? String ?: return null }.takeIf { it.all(String::isNotBlank) } }
