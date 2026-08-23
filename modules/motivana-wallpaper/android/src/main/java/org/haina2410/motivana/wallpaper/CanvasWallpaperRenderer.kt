package org.haina2410.motivana.wallpaper

import android.graphics.*
import android.content.res.AssetManager
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import kotlin.math.*

data class RotationLayout(val quoteLeft: Float, val quoteTop: Float, val quoteRight: Float, val quoteBottom: Float, val fontSize: Float, val authorY: Float, val truncated: Boolean, val maxLines: Int? = null)
class CanvasWallpaperRenderer(private val catalog: RotationCatalog, private val fonts: Map<String, Typeface>, private val assets: AssetManager? = null) {
  private data class MeasuredQuote(val geometry: RotationLayout, val staticLayout: StaticLayout)

  fun layout(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): RotationLayout = measure(quote, preset, width, height).geometry

  /** Every candidate is a real StaticLayout; render retains this exact measured layout to draw. */
  private fun measure(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): MeasuredQuote {
    require(WallpaperImageSafety.hasSafeRgbaAllocation(width, height))
    val left = width * .08f; val right = width - left; val topSafe = height * .10f; val bottomSafe = height * .90f
    val authorSize = round(width * .028).toFloat(); val gap = if (quote.author == null) 0f else height * .022f; val authorHeight = if (quote.author == null) 0f else authorSize * 1.2f
    val maxHeight = bottomSafe - topSafe - authorHeight - gap
    val preferred = round(width * preset.preferredRatio).toInt(); val minimum = round(width * preset.minimumRatio).toInt(); var size = preferred; var quoteLayout: StaticLayout
    while (true) { quoteLayout = quoteLayout(quote.text, preset, right - left, size.toFloat(), null); if (quoteLayout.height <= maxHeight || size == minimum) break; size-- }
    val truncated = quoteLayout.height > maxHeight
    val maxLines = if (truncated) {
      var lines = quoteLayout.lineCount
      while (lines > 1 && quoteLayout(quote.text, preset, right - left, size.toFloat(), lines).height > maxHeight) lines--
      lines
    } else null
    if (truncated) quoteLayout = quoteLayout(quote.text, preset, right - left, size.toFloat(), maxLines)
    val quoteHeight = quoteLayout.height.toFloat()
    val desired = height * preset.quotePositionY.toFloat() - quoteHeight / 2f; val quoteTop = desired.coerceIn(topSafe, bottomSafe - quoteHeight - gap - authorHeight)
    return MeasuredQuote(RotationLayout(left, quoteTop, right, quoteTop + quoteHeight, size.toFloat(), quoteTop + quoteHeight + gap, truncated, maxLines), quoteLayout)
  }
  fun render(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): Bitmap {
    require(WallpaperImageSafety.hasSafeRgbaAllocation(width, height)); val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888); val canvas = Canvas(bitmap); val paint = Paint(Paint.ANTI_ALIAS_FLAG); paint.shader = when (val bg = preset.background) { is RotationBackground.Solid -> null; is RotationBackground.Gradient -> gradient(bg, width, height) }; canvas.drawColor((preset.background as? RotationBackground.Solid)?.let { Color.parseColor(it.color) } ?: Color.TRANSPARENT); if (paint.shader != null) canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint); preset.overlay?.let { canvas.drawColor(Color.parseColor(it)) }
    paint.shader = null; paint.color = Color.argb(52, Color.red(Color.parseColor(preset.authorColor)), Color.green(Color.parseColor(preset.authorColor)), Color.blue(Color.parseColor(preset.authorColor))); canvas.drawCircle(width * .9f, height * .12f, min(width, height) * .035f, paint)
    val measured = measure(quote, preset, width, height); val layout = measured.geometry; paint.shader = null; paint.color = Color.parseColor(preset.textColor); paint.typeface = typeface(preset); paint.textSize = layout.fontSize
    canvas.save(); canvas.translate(layout.quoteLeft, layout.quoteTop); measured.staticLayout.draw(canvas); canvas.restore()
    quote.author?.let { paint.color = Color.parseColor(preset.authorColor); paint.textSize = round(width*.028).toFloat(); paint.textAlign = when(preset.align) { "center" -> Paint.Align.CENTER; "right" -> Paint.Align.RIGHT; else -> Paint.Align.LEFT }; val authorX = when(preset.align) { "center" -> width/2f; "right" -> layout.quoteRight; else -> layout.quoteLeft }; canvas.drawText("— $it", authorX, layout.authorY + paint.textSize, paint) }; return bitmap
  }
  private fun quoteLayout(text: String, preset: RotationPreset, width: Float, size: Float, maxLines: Int?): StaticLayout {
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = typeface(preset); textSize = size; color = Color.parseColor(preset.textColor) }
    val alignment = when (preset.align) { "center" -> Layout.Alignment.ALIGN_CENTER; "right" -> Layout.Alignment.ALIGN_OPPOSITE; else -> Layout.Alignment.ALIGN_NORMAL }
    return StaticLayout.Builder.obtain(text, 0, text.length, paint, width.toInt()).setAlignment(alignment).setIncludePad(false).setLineSpacing(0f, preset.lineHeight.toFloat()).apply { if (maxLines != null) setMaxLines(maxLines).setEllipsize(android.text.TextUtils.TruncateAt.END).setEllipsizedWidth(width.toInt()) }.build()
  }
  private fun typeface(p: RotationPreset): Typeface = fonts["${p.family}-${p.weight}"] ?: assets?.let { runCatching { Typeface.createFromAsset(it, "fonts/${p.family}-${p.weight}.ttf") }.getOrElse { throw IllegalStateException("FONT_MISSING") } } ?: Typeface.DEFAULT
  internal fun gradientCoordinates(angle: Double, width: Int, height: Int): FloatArray { val radians = Math.toRadians(angle); val radius = hypot(width.toDouble(), height.toDouble()) / 2.0; val dx = cos(radians) * radius; val dy = sin(radians) * radius; return floatArrayOf((width / 2.0 - dx).toFloat(), (height / 2.0 - dy).toFloat(), (width / 2.0 + dx).toFloat(), (height / 2.0 + dy).toFloat()) }
  private fun gradient(bg: RotationBackground.Gradient, width: Int, height: Int): LinearGradient { val points = gradientCoordinates(bg.angle, width, height); return LinearGradient(points[0], points[1], points[2], points[3], Color.parseColor(bg.start), Color.parseColor(bg.end), Shader.TileMode.CLAMP) }
}
