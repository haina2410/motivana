package org.haina2410.motivana.wallpaper

import android.graphics.*
import android.content.res.AssetManager
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import kotlin.math.*

data class RotationLayout(val quoteLeft: Float, val quoteTop: Float, val quoteRight: Float, val quoteBottom: Float, val fontSize: Float, val authorY: Float, val truncated: Boolean, val maxLines: Int? = null, val lineCount: Int = 0)
data class RotationAccent(val centerX: Float, val centerY: Float, val radius: Float)
private data class RendererResources(val bitmapFactory: (Int, Int) -> Bitmap, val afterAllocation: (Bitmap) -> Unit)
class CanvasWallpaperRenderer private constructor(
  private val catalog: RotationCatalog,
  private val fonts: Map<String, Typeface>,
  private val assets: AssetManager?,
  private val resources: RendererResources,
) {
  constructor(catalog: RotationCatalog, fonts: Map<String, Typeface>, assets: AssetManager? = null) : this(catalog, fonts, assets, RendererResources({ width, height -> Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888) }, {}))
  internal constructor(catalog: RotationCatalog, fonts: Map<String, Typeface>, assets: AssetManager?, bitmapFactory: (Int, Int) -> Bitmap, afterAllocation: (Bitmap) -> Unit) : this(catalog, fonts, assets, RendererResources(bitmapFactory, afterAllocation))
  private data class MeasuredQuote(val geometry: RotationLayout, val staticLayout: StaticLayout)
  private data class CanonicalQuoteLayout(
    val fontSize: Int,
    val height: Float,
    val truncated: Boolean,
    val maxLines: Int,
    val lineCount: Int,
  )

  fun layout(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): RotationLayout = measure(quote, preset, width, height).geometry

  /** Geometry follows the shared deterministic contract; render retains StaticLayout for shaping. */
  private fun measure(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): MeasuredQuote {
    require(WallpaperImageSafety.hasSafeRgbaAllocation(width, height))
    val left = width * .08f; val right = width - left; val topSafe = height * .10f; val bottomSafe = height * .90f
    val authorSize = round(width * .028).toFloat(); val gap = if (quote.author == null) 0f else height * .022f; val authorHeight = if (quote.author == null) 0f else authorSize * 1.2f
    val maxHeight = bottomSafe - topSafe - authorHeight - gap
    val canonical = canonicalQuoteLayout(quote.text, width, right - left, preset, maxHeight)
    val quoteLayout = quoteLayout(
      quote.text,
      preset,
      right - left,
      canonical.fontSize.toFloat(),
      canonical.maxLines,
      canonical.truncated,
    )
    val quoteHeight = canonical.height
    val desired = height * preset.quotePositionY.toFloat() - quoteHeight / 2f
    val maximumQuoteTop = max(topSafe, bottomSafe - quoteHeight - gap - authorHeight)
    val quoteTop = desired.coerceIn(topSafe, maximumQuoteTop)
    return MeasuredQuote(RotationLayout(left, quoteTop, right, quoteTop + quoteHeight, canonical.fontSize.toFloat(), quoteTop + quoteHeight + gap, canonical.truncated, canonical.maxLines, canonical.lineCount), quoteLayout)
  }
  fun render(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): Bitmap {
    require(WallpaperImageSafety.hasSafeRgbaAllocation(width, height)); val bitmap = resources.bitmapFactory(width, height)
    try {
      resources.afterAllocation(bitmap)
      val canvas = Canvas(bitmap); val paint = Paint(Paint.ANTI_ALIAS_FLAG); paint.shader = when (val bg = preset.background) { is RotationBackground.Solid -> null; is RotationBackground.Gradient -> gradient(bg, width, height) }; canvas.drawColor((preset.background as? RotationBackground.Solid)?.let { Color.parseColor(it.color) } ?: Color.TRANSPARENT); if (paint.shader != null) canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint); preset.overlay?.let { canvas.drawColor(Color.parseColor(it)) }
      val measured = measure(quote, preset, width, height); val layout = measured.geometry
      val accent = accentGeometry(layout, preset); paint.shader = null; paint.color = Color.argb((255 * .35f).toInt(), Color.red(Color.parseColor(preset.authorColor)), Color.green(Color.parseColor(preset.authorColor)), Color.blue(Color.parseColor(preset.authorColor))); canvas.drawCircle(accent.centerX, accent.centerY, accent.radius, paint)
      paint.shader = null; paint.color = Color.parseColor(preset.textColor); paint.typeface = typeface(preset); paint.textSize = layout.fontSize
      canvas.save(); canvas.translate(layout.quoteLeft, layout.quoteTop); measured.staticLayout.draw(canvas); canvas.restore()
      quote.author?.let { paint.color = Color.parseColor(preset.authorColor); paint.textSize = round(width*.028).toFloat(); paint.textAlign = when(preset.align) { "center" -> Paint.Align.CENTER; "right" -> Paint.Align.RIGHT; else -> Paint.Align.LEFT }; val authorX = when(preset.align) { "center" -> width/2f; "right" -> layout.quoteRight; else -> layout.quoteLeft }; canvas.drawText("— $it", authorX, layout.authorY + paint.textSize, paint) }
      return bitmap
    } catch (error: Throwable) {
      bitmap.recycle()
      throw error
    }
  }
  /** Matches Task4 scene accent coordinates from the retained quote layout. */
  internal fun accentGeometry(layout: RotationLayout, preset: RotationPreset): RotationAccent {
    val markSize = layout.fontSize * 1.5f
    val markX = if (preset.align == "right") layout.quoteRight - markSize else layout.quoteLeft
    return RotationAccent(markX + markSize / 2f, layout.quoteTop - markSize / 3f, markSize / 10f)
  }
  /**
   * The shared foreground contract deliberately uses UTF-16 code-unit capacity,
   * not platform glyph shaping: JavaScript's String.length and Kotlin's String
   * length then agree exactly. StaticLayout remains responsible only for drawing
   * within the resulting deterministic line budget.
   */
  private fun canonicalQuoteLayout(text: String, outputWidth: Int, quoteWidth: Float, preset: RotationPreset, maxHeight: Float): CanonicalQuoteLayout {
    val preferred = round(outputWidth * preset.preferredRatio).toInt()
    val minimum = round(outputWidth * preset.minimumRatio).toInt()
    for (fontSize in preferred downTo minimum) {
      val lineHeight = fontSize * preset.lineHeight
      val charactersPerLine = max(1, floor(quoteWidth / (fontSize * .52)).toInt())
      val lineCount = max(1, ceil(text.length.toDouble() / charactersPerLine).toInt())
      val measuredHeight = (lineCount * lineHeight).toFloat()
      if (measuredHeight <= maxHeight) {
        return CanonicalQuoteLayout(fontSize, measuredHeight, false, lineCount, lineCount)
      }
    }
    val lineHeight = minimum * preset.lineHeight
    val maxLines = max(1, floor(maxHeight / lineHeight).toInt())
    return CanonicalQuoteLayout(minimum, maxHeight, true, maxLines, maxLines)
  }

  private fun quoteLayout(text: String, preset: RotationPreset, width: Float, size: Float, maxLines: Int, truncated: Boolean): StaticLayout {
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = typeface(preset); textSize = size; color = Color.parseColor(preset.textColor) }
    val alignment = when (preset.align) { "center" -> Layout.Alignment.ALIGN_CENTER; "right" -> Layout.Alignment.ALIGN_OPPOSITE; else -> Layout.Alignment.ALIGN_NORMAL }
    val canonicalLineHeight = size * preset.lineHeight.toFloat()
    val naturalLineHeight = (paint.fontMetrics.descent - paint.fontMetrics.ascent)
    return StaticLayout.Builder.obtain(text, 0, text.length, paint, width.toInt()).setAlignment(alignment).setIncludePad(false).setLineSpacing(canonicalLineHeight - naturalLineHeight, 1f).setMaxLines(maxLines).apply { if (truncated) setEllipsize(android.text.TextUtils.TruncateAt.END).setEllipsizedWidth(width.toInt()) }.build()
  }
  private fun typeface(p: RotationPreset): Typeface = fonts["${p.family}-${p.weight}"] ?: assets?.let { runCatching { Typeface.createFromAsset(it, "fonts/${p.family}-${p.weight}.ttf") }.getOrElse { throw IllegalStateException("FONT_MISSING") } } ?: Typeface.DEFAULT
  internal fun gradientCoordinates(angle: Double, width: Int, height: Int): FloatArray { val radians = Math.toRadians(angle); val radius = hypot(width.toDouble(), height.toDouble()) / 2.0; val dx = cos(radians) * radius; val dy = sin(radians) * radius; return floatArrayOf((width / 2.0 - dx).toFloat(), (height / 2.0 - dy).toFloat(), (width / 2.0 + dx).toFloat(), (height / 2.0 + dy).toFloat()) }
  private fun gradient(bg: RotationBackground.Gradient, width: Int, height: Int): LinearGradient { val points = gradientCoordinates(bg.angle, width, height); return LinearGradient(points[0], points[1], points[2], points[3], Color.parseColor(bg.start), Color.parseColor(bg.end), Shader.TileMode.CLAMP) }
}
