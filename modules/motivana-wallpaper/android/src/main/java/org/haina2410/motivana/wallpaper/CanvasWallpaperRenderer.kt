package org.haina2410.motivana.wallpaper

import android.graphics.*
import android.content.res.AssetManager
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
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
    require(WallpaperImageSafety.hasSafeRgbaAllocation(width, height)); val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888); val canvas = Canvas(bitmap); val paint = Paint(Paint.ANTI_ALIAS_FLAG); paint.shader = when (val bg = preset.background) { is RotationBackground.Solid -> null; is RotationBackground.Gradient -> gradient(bg, width, height) }; canvas.drawColor((preset.background as? RotationBackground.Solid)?.let { Color.parseColor(it.color) } ?: Color.TRANSPARENT); if (paint.shader != null) canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint); preset.overlay?.let { canvas.drawColor(Color.parseColor(it)) }
    paint.shader = null; paint.color = Color.argb(52, Color.red(Color.parseColor(preset.authorColor)), Color.green(Color.parseColor(preset.authorColor)), Color.blue(Color.parseColor(preset.authorColor))); canvas.drawCircle(width * .9f, height * .12f, min(width, height) * .035f, paint)
    val layout = layout(quote, preset, width, height); paint.shader = null; paint.color = Color.parseColor(preset.textColor); paint.typeface = typeface(preset); paint.textSize = layout.fontSize
    val textPaint = TextPaint().apply { set(paint); textAlign = Paint.Align.LEFT }
    val alignment = when (preset.align) { "center" -> Layout.Alignment.ALIGN_CENTER; "right" -> Layout.Alignment.ALIGN_OPPOSITE; else -> Layout.Alignment.ALIGN_NORMAL }
    val text = if (layout.truncated) quote.text.takeWhile { it != '\n' }.trimEnd().plus("…") else quote.text
    @Suppress("DEPRECATION")
    val quoteLayout = StaticLayout(text, textPaint, (layout.quoteRight - layout.quoteLeft).toInt(), alignment, preset.lineHeight.toFloat(), 0f, false)
    canvas.save(); canvas.translate(layout.quoteLeft, layout.quoteTop); quoteLayout.draw(canvas); canvas.restore()
    quote.author?.let { paint.color = Color.parseColor(preset.authorColor); paint.textSize = round(width*.028).toFloat(); paint.textAlign = when(preset.align) { "center" -> Paint.Align.CENTER; "right" -> Paint.Align.RIGHT; else -> Paint.Align.LEFT }; val authorX = when(preset.align) { "center" -> width/2f; "right" -> layout.quoteRight; else -> layout.quoteLeft }; canvas.drawText("— $it", authorX, layout.authorY + paint.textSize, paint) }; return bitmap
  }
  private fun typeface(p: RotationPreset): Typeface = fonts["${p.family}-${p.weight}"] ?: assets?.let { runCatching { Typeface.createFromAsset(it, "fonts/${p.family}-${p.weight}.ttf") }.getOrElse { throw IllegalStateException("FONT_MISSING") } } ?: Typeface.DEFAULT
  private fun gradient(bg: RotationBackground.Gradient, width: Int, height: Int): LinearGradient { val radians = Math.toRadians(bg.angle); val radius = hypot(width.toDouble(), height.toDouble()) / 2.0; val dx = cos(radians) * radius; val dy = sin(radians) * radius; return LinearGradient((width / 2.0 - dx).toFloat(), (height / 2.0 - dy).toFloat(), (width / 2.0 + dx).toFloat(), (height / 2.0 + dy).toFloat(), Color.parseColor(bg.start), Color.parseColor(bg.end), Shader.TileMode.CLAMP) }
  private fun approximateWrap(text: String, width: Float, size: Float): List<String> { val chars = max(1, floor(width / (size * .52f)).toInt()); return text.chunked(chars) }
  private fun wrap(text: String, paint: Paint, maxWidth: Float): List<String> { val words = text.trim().split(Regex("\\s+")); val result = mutableListOf<String>(); var line = ""; for (word in words) { val candidate = if (line.isEmpty()) word else "$line $word"; if (paint.measureText(candidate) <= maxWidth || line.isEmpty()) line = candidate else { result += line; line = word } }; if (line.isNotEmpty()) result += line; return result }
}
