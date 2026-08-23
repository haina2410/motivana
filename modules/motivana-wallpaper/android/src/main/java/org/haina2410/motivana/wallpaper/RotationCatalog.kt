package org.haina2410.motivana.wallpaper

import android.content.res.AssetManager
import android.graphics.Typeface
import java.io.IOException
import org.json.JSONArray
import org.json.JSONObject

object RotationCatalogLoader {
  fun load(assets: AssetManager): RotationCatalog = try {
    RotationCatalog(
      parseQuotes(assets.open("data/quotes.json").bufferedReader().use { it.readText() }),
      parsePresets(assets.open("data/presets.json").bufferedReader().use { it.readText() }),
    ).also { catalog -> RotationCatalogValidator.validate(catalog); validateFonts(assets, catalog) }
  } catch (e: CatalogException) {
    throw e
  } catch (e: IOException) {
    throw TransientRotationException("ASSET_IO")
  } catch (_: Exception) {
    throw CatalogException("ASSET_INVALID")
  }

  private fun validateFonts(assets: AssetManager, catalog: RotationCatalog) {
    catalog.presets.map { "${it.family}-${it.weight}" }.distinct().forEach { font ->
      try {
        assets.open("fonts/$font.ttf").use { it.read() }
        Typeface.createFromAsset(assets, "fonts/$font.ttf") ?: throw CatalogException("FONT_MISSING")
      } catch (e: CatalogException) {
        throw e
      } catch (_: Exception) {
        throw CatalogException("FONT_MISSING")
      }
    }
  }
  fun parseQuotes(source: String): List<RotationQuote> = JSONArray(source).let { array -> (0 until array.length()).map { index -> array.getJSONObject(index).let { RotationQuote(it.getString("id"), it.getString("text"), it.optString("author").takeIf(String::isNotBlank), it.getString("category")) } } }
  fun parsePresets(source: String): List<RotationPreset> = JSONArray(source).let { array -> (0 until array.length()).map { index ->
    val p = array.getJSONObject(index); val background = p.getJSONObject("background")
    val bg = when (background.getString("kind")) { "solid" -> RotationBackground.Solid(background.getString("color")); "linear-gradient" -> RotationBackground.Gradient(background.getString("startColor"), background.getString("endColor"), background.getDouble("angleDegrees")); else -> throw CatalogException("INVALID_CATALOG") }
    RotationPreset(p.getString("id"), p.getString("fontFamily"), p.getString("fontWeight"), p.getString("textAlign"), p.getDouble("quotePositionY"), p.getDouble("preferredFontSizeRatio"), p.getDouble("minimumFontSizeRatio"), p.getDouble("lineHeight"), p.getString("textColor"), p.getString("authorColor"), bg, p.optString("overlay").takeIf(String::isNotBlank))
  } }
}

class CatalogException(val code: String) : IllegalStateException(code)
object RotationCatalogValidator {
  private val categories = setOf("motivation", "discipline", "focus", "confidence", "growth", "success")
  private val fonts = setOf("Inter-Regular", "Inter-SemiBold", "Lora-Regular", "Lora-SemiBold", "Oswald-Medium")
  private val color = Regex("#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?")
  fun validate(catalog: RotationCatalog) {
    fun invalid(): Nothing = throw CatalogException("INVALID_CATALOG")
    if (catalog.quotes.size != 120 || catalog.presets.size != 8) invalid()
    if (catalog.quotes.map { it.id }.toSet().size != 120 || catalog.presets.map { it.id }.toSet().size != 8) invalid()
    if (catalog.quotes.any { it.id.isBlank() || it.text.trim().length < 12 || it.category !in categories } || catalog.quotes.map { it.category }.toSet() != categories) invalid()
    catalog.presets.forEach { p ->
      if ("${p.family}-${p.weight}" !in fonts || p.align !in setOf("left", "center", "right") || p.quotePositionY !in .1..0.9 || p.minimumRatio <= 0 || p.preferredRatio < p.minimumRatio || p.lineHeight !in 1.0..2.0 || !color.matches(p.textColor) || !color.matches(p.authorColor) || (p.overlay != null && !color.matches(p.overlay))) invalid()
      when (val background = p.background) { is RotationBackground.Solid -> if (!color.matches(background.color)) invalid(); is RotationBackground.Gradient -> if (!color.matches(background.start) || !color.matches(background.end) || !background.angle.isFinite()) invalid() }
    }
  }
}

class RotationSelector(private val random: java.util.Random) {
  fun select(catalog: RotationCatalog, eligibleIds: List<String>?, previousQuoteId: String?, previousPresetId: String?, randomizePreset: Boolean, preferredPresetId: String): RotationSelection {
    val eligible = eligibleIds?.let { ids -> catalog.quotes.filter { it.id in ids } } ?: catalog.quotes
    if (eligible.isEmpty()) throw SelectionException("NO_ELIGIBLE_QUOTES")
    val quoteChoices = eligible.filter { it.id != previousQuoteId }.ifEmpty { eligible }
    val presets = if (randomizePreset) catalog.presets.filter { it.id != previousPresetId }.ifEmpty { catalog.presets } else listOfNotNull(catalog.preset(preferredPresetId))
    if (presets.isEmpty()) throw SelectionException("INVALID_CONFIGURATION")
    return RotationSelection(quoteChoices[random.nextInt(quoteChoices.size)], presets[random.nextInt(presets.size)])
  }
}
