package org.haina2410.motivana.wallpaper

import android.content.res.AssetManager
import android.graphics.Typeface
import java.io.FileNotFoundException
import java.io.IOException
import org.json.JSONArray
import org.json.JSONObject

object RotationCatalogLoader {
  fun load(assets: AssetManager): RotationCatalog = try {
    RotationCatalog(
      parseQuotes(assets.open("data/quotes.json").bufferedReader().use { it.readText() }),
      parsePresets(assets.open("data/backgrounds.json").bufferedReader().use { it.readText() }),
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
      } catch (_: FileNotFoundException) {
        throw CatalogException("FONT_MISSING")
      } catch (_: IOException) {
        throw TransientRotationException("ASSET_IO")
      } catch (_: Exception) {
        throw CatalogException("FONT_MISSING")
      }
    }
  }
  fun parseQuotes(source: String): List<RotationQuoteEntry> = JSONArray(source).let { array -> (0 until array.length()).map { index -> array.getJSONObject(index).let { item ->
    // `text` must be an object. org.json coerces an object to its own JSON string, so a
    // string read here would put the raw JSON on the wallpaper instead of the quote.
    val texts = item.opt("text") as? JSONObject ?: throw CatalogException("INVALID_CATALOG")
    RotationQuoteEntry(item.getString("id"), texts.keys().asSequence().associateWith(texts::getString), item.getString("sourceLocale"), item.optString("author").takeIf(String::isNotBlank), item.getString("category"))
  } } }
  fun parsePresets(source: String): List<RotationPreset> = JSONArray(source).let { array -> (0 until array.length()).map { index ->
    val p = array.getJSONObject(index); val background = p.getJSONObject("background")
    val bg = when (background.getString("kind")) { "solid" -> RotationBackground.Solid(background.getString("color")); "linear-gradient" -> RotationBackground.Gradient(background.getString("startColor"), background.getString("endColor"), background.getDouble("angleDegrees")); "image" -> RotationBackground.Image(background.getString("asset"), background.getString("scrimColor"), background.getDouble("scrimOpacity"), background.getDouble("effectiveLuminance")); else -> throw CatalogException("INVALID_CATALOG") }
    RotationPreset(p.getString("id"), p.getString("fontFamily"), p.getString("fontWeight"), p.getString("textAlign"), p.getDouble("quotePositionY"), p.getDouble("preferredFontSizeRatio"), p.getDouble("minimumFontSizeRatio"), p.getDouble("lineHeight"), p.getString("textColor"), p.getString("authorColor"), bg, p.optString("overlay").takeIf(String::isNotBlank))
  } }
}

class CatalogException(val code: String) : IllegalStateException(code)
object RotationCatalogValidator {
  private val categories = setOf("motivation", "discipline", "focus", "confidence", "growth", "success")
  private val fonts = setOf("CormorantGaramond-Light", "CormorantGaramond-Regular", "BeVietnamPro-Light", "DancingScript-Medium", "Lora-Regular", "Lora-SemiBold")
  private val color = Regex("#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?")
  // The catalogue has no fixed size: it grows as sourced quotes replace the
  // original app copy. The worker holds the same floor as scripts/verify-data.mjs.
  private const val MINIMUM_QUOTES_PER_CATEGORY = 6
  fun validate(catalog: RotationCatalog) {
    fun invalid(): Nothing = throw CatalogException("INVALID_CATALOG")
    // The catalogue grows as photographs are sourced, so it holds no fixed
    // number of presets. scripts/verify-data.mjs keeps the four stable ids in
    // the file; here an empty set is what would break the selector.
    if (catalog.presets.isEmpty() || catalog.presets.map { it.id }.toSet().size != catalog.presets.size) invalid()
    if (catalog.quotes.map { it.id }.toSet().size != catalog.quotes.size) invalid()
    if (categories.any { category -> catalog.quotes.count { it.category == category } < MINIMUM_QUOTES_PER_CATEGORY }) invalid()
    if (catalog.quotes.any { quote -> quote.id.isBlank() || quote.category !in categories || quote.sourceLocale !in RotationLocales.supported || quote.text.keys.any { it !in RotationLocales.supported } || quote.sourceLocale !in quote.text || quote.text.values.any { it.trim().length < 12 || it.length > 160 } } || catalog.quotes.map { it.category }.toSet() != categories) invalid()
    catalog.presets.forEach { p ->
      if ("${p.family}-${p.weight}" !in fonts || p.align !in setOf("left", "center", "right") || p.quotePositionY !in .1..0.9 || p.minimumRatio <= 0 || p.preferredRatio < p.minimumRatio || p.lineHeight !in 1.0..2.0 || !color.matches(p.textColor) || !color.matches(p.authorColor) || (p.overlay != null && !color.matches(p.overlay))) invalid()
      when (val background = p.background) { is RotationBackground.Solid -> if (!color.matches(background.color)) invalid(); is RotationBackground.Gradient -> if (!color.matches(background.start) || !color.matches(background.end) || !background.angle.isFinite()) invalid(); is RotationBackground.Image -> if (background.asset != "backgrounds/${p.id}.webp" || !color.matches(background.scrimColor) || background.scrimOpacity !in 0.0..1.0 || background.luminance !in 0.0..1.0) invalid() }
    }
  }
}

class RotationSelector(private val random: java.util.Random) {
  fun select(catalog: RotationCatalog, eligibleIds: List<String>?, previousQuoteId: String?, previousPresetId: String?, randomizePreset: Boolean, preferredPresetId: String, locale: String): RotationSelection {
    // A favorites pool is NOT filtered by language: the reader chose those quotes on
    // purpose, so they stay usable in any language, exactly like favoriteQuoteText.
    // The general pool IS filtered, because showing an unrequested language is worse
    // than showing a different quote.
    val eligible = eligibleIds?.let { ids -> catalog.quotes.filter { it.id in ids } }
      ?: catalog.quotes.filter { it.hasLocale(locale) }
    if (eligible.isEmpty()) throw SelectionException("NO_ELIGIBLE_QUOTES")
    val quoteChoices = eligible.filter { it.id != previousQuoteId }.ifEmpty { eligible }
    val presets = if (randomizePreset) catalog.presets.filter { it.id != previousPresetId }.ifEmpty { catalog.presets } else listOfNotNull(catalog.preset(preferredPresetId))
    if (presets.isEmpty()) throw SelectionException("INVALID_CONFIGURATION")
    return RotationSelection(quoteChoices[random.nextInt(quoteChoices.size)].resolve(locale), presets[random.nextInt(presets.size)])
  }
}
