package org.haina2410.motivana.wallpaper

import android.graphics.*
import android.content.res.AssetManager
import kotlin.math.*

data class RotationLayout(val quoteLeft: Float, val quoteTop: Float, val quoteRight: Float, val quoteBottom: Float, val fontSize: Float, val authorY: Float, val truncated: Boolean)
class CanvasWallpaperRenderer(private val catalog: RotationCatalog, private val fonts: Map<String, Typeface>, private val assets: AssetManager? = null) {
  fun layout(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): RotationLayout {
    require(WallpaperImageSafety.hasSafeRgbaAllocation(width, height))
    val left = width * .08f; val right = width - left; val topSafe = height * .10f; val bottomSafe = height * .90f
    val authorSize = round(width * .028).toFloat(); val gap = if (quote.author == null) 0f else height * .022f; val authorHeight = if (quote.author == null) 0f else authorSize * 1.2f
    val maxHeight = bottomSafe - topSafe - authorHeight - gap
    val preferred = round(width * preset.preferredRatio).toInt(); val minimum = round(width * preset.minimumRatio).toInt(); var size = preferred; var lines: List<String>; var quoteHeight: Float
    while (true) { lines = approximateWrap(quote.text, right - left, size.toFloat()); quoteHeight = lines.size * size * preset.lineHeight.toFloat(); if (quoteHeight <= maxHeight || size == minimum) break; size-- }
    val truncated = quoteHeight > maxHeight; if (truncated) { val count = max(1, floor(maxHeight / (size * preset.lineHeight)).toInt()); lines = lines.take(count).toMutableList().also { it[it.lastIndex] = it.last().trimEnd().dropLast(1).plus("…") }; quoteHeight = maxHeight }
    val desired = height * preset.quotePositionY.toFloat() - quoteHeight / 2f; val quoteTop = desired.coerceIn(topSafe, bottomSafe - quoteHeight - gap - authorHeight)
    return RotationLayout(left, quoteTop, right, quoteTop + quoteHeight, size.toFloat(), quoteTop + quoteHeight + gap, truncated)
  }
  fun render(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): Bitmap {
    require(WallpaperImageSafety.hasSafeRgbaAllocation(width, height)); val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888); val canvas = Canvas(bitmap); val paint = Paint(Paint.ANTI_ALIAS_FLAG); paint.shader = when (val bg = preset.background) { is RotationBackground.Solid -> null; is RotationBackground.Gradient -> LinearGradient(0f, 0f, width.toFloat(), height.toFloat(), Color.parseColor(bg.start), Color.parseColor(bg.end), Shader.TileMode.CLAMP) }; canvas.drawColor((preset.background as? RotationBackground.Solid)?.let { Color.parseColor(it.color) } ?: Color.TRANSPARENT); if (paint.shader != null) canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint); preset.overlay?.let { canvas.drawColor(Color.parseColor(it)) }
    val layout = layout(quote, preset, width, height); paint.shader = null; paint.color = Color.parseColor(preset.textColor); paint.typeface = typeface(preset); paint.textSize = layout.fontSize; paint.textAlign = when(preset.align) { "center" -> Paint.Align.CENTER; "right" -> Paint.Align.RIGHT; else -> Paint.Align.LEFT }; val x = when(preset.align) { "center" -> width / 2f; "right" -> layout.quoteRight; else -> layout.quoteLeft }; val renderedText = if (layout.truncated) quote.text.take(220).plus("…") else quote.text; wrap(renderedText, paint, layout.quoteRight-layout.quoteLeft).forEachIndexed { i, line -> canvas.drawText(line, x, layout.quoteTop + paint.textSize + i * paint.fontSpacing * preset.lineHeight.toFloat(), paint) }; quote.author?.let { paint.color = Color.parseColor(preset.authorColor); paint.textSize = round(width*.028).toFloat(); canvas.drawText("— $it", x, layout.authorY + paint.textSize, paint) }; return bitmap
  }
  private fun typeface(p: RotationPreset): Typeface = fonts["${p.family}-${p.weight}"] ?: assets?.let { runCatching { Typeface.createFromAsset(it, "fonts/${p.family}-${p.weight}.ttf") }.getOrNull() } ?: Typeface.DEFAULT
  private fun approximateWrap(text: String, width: Float, size: Float): List<String> { val chars = max(1, floor(width / (size * .52f)).toInt()); return text.chunked(chars) }
  private fun wrap(text: String, paint: Paint, maxWidth: Float): List<String> { val words = text.trim().split(Regex("\\s+")); val result = mutableListOf<String>(); var line = ""; for (word in words) { val candidate = if (line.isEmpty()) word else "$line $word"; if (paint.measureText(candidate) <= maxWidth || line.isEmpty()) line = candidate else { result += line; line = word } }; if (line.isNotEmpty()) result += line; return result }
}
