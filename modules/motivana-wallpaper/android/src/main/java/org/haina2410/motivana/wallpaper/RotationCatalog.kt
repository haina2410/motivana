package org.haina2410.motivana.wallpaper

import android.content.res.AssetManager
import org.json.JSONArray
import org.json.JSONObject

object RotationCatalogLoader {
  fun load(assets: AssetManager): RotationCatalog = RotationCatalog(parseQuotes(assets.open("data/quotes.json").bufferedReader().use { it.readText() }), parsePresets(assets.open("data/presets.json").bufferedReader().use { it.readText() }))
  fun parseQuotes(source: String): List<RotationQuote> = JSONArray(source).let { array -> (0 until array.length()).map { index -> array.getJSONObject(index).let { RotationQuote(it.getString("id"), it.getString("text"), it.optString("author").takeIf(String::isNotBlank)) } } }
  fun parsePresets(source: String): List<RotationPreset> = JSONArray(source).let { array -> (0 until array.length()).map { index ->
    val p = array.getJSONObject(index); val background = p.getJSONObject("background")
    val bg = if (background.getString("kind") == "solid") RotationBackground.Solid(background.getString("color")) else RotationBackground.Gradient(background.getString("startColor"), background.getString("endColor"), background.getDouble("angleDegrees"))
    RotationPreset(p.getString("id"), p.getString("fontFamily"), p.getString("fontWeight"), p.getString("textAlign"), p.getDouble("quotePositionY"), p.getDouble("preferredFontSizeRatio"), p.getDouble("minimumFontSizeRatio"), p.getDouble("lineHeight"), p.getString("textColor"), p.getString("authorColor"), bg, p.optString("overlay").takeIf(String::isNotBlank))
  } }
}

class RotationSelector(private val random: java.util.Random) {
  fun select(catalog: RotationCatalog, eligibleIds: List<String>, previousQuoteId: String?, previousPresetId: String?, randomizePreset: Boolean, preferredPresetId: String): RotationSelection {
    val eligible = if (eligibleIds.isEmpty()) catalog.quotes else catalog.quotes.filter { it.id in eligibleIds }
    if (eligible.isEmpty()) throw SelectionException("NO_ELIGIBLE_QUOTES")
    val quoteChoices = eligible.filter { it.id != previousQuoteId }.ifEmpty { eligible }
    val presets = if (randomizePreset) catalog.presets.filter { it.id != previousPresetId }.ifEmpty { catalog.presets } else listOfNotNull(catalog.preset(preferredPresetId))
    if (presets.isEmpty()) throw SelectionException("INVALID_CONFIGURATION")
    return RotationSelection(quoteChoices[random.nextInt(quoteChoices.size)], presets[random.nextInt(presets.size)])
  }
}
