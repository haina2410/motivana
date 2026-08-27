package org.haina2410.motivana.wallpaper

import android.graphics.*
import android.content.res.AssetManager
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import kotlin.math.*

data class RotationLayout(val quoteLeft: Float, val quoteTop: Float, val quoteRight: Float, val quoteBottom: Float, val fontSize: Float, val authorY: Float, val truncated: Boolean, val maxLines: Int? = null, val lineCount: Int = 0)
data class RotationAccent(val centerX: Float, val centerY: Float, val radius: Float)
/** How far above and below the quote the scrim fades out, as a fraction. */
private const val SCRIM_SPREAD = 0.42f

/**
 * The five gradient stops of the scrim: clear at both edges, peaking on the
 * quote, and clear again well before the frame ends. A wash over the whole
 * frame would flatten the photograph; the quote only needs contrast where it
 * sits. Stops stay non-decreasing when the quote sits near an edge.
 */
internal fun scrimStops(quotePositionY: Double): FloatArray {
  val centre = quotePositionY.toFloat().coerceIn(0f, 1f)
  return floatArrayOf(0f, max(0f, centre - SCRIM_SPREAD), centre, min(1f, centre + SCRIM_SPREAD), 1f)
}

/**
 * The source rectangle that fills the canvas without distorting the
 * photograph. Backgrounds are cut to the phone aspect ratio already, so this
 * normally takes the whole frame; it bites when the two disagree.
 */
internal fun coverSource(imageWidth: Int, imageHeight: Int, width: Int, height: Int): Rect {
  val scale = max(width.toFloat() / imageWidth, height.toFloat() / imageHeight)
  val sourceWidth = width / scale; val sourceHeight = height / scale
  val left = (imageWidth - sourceWidth) / 2f; val top = (imageHeight - sourceHeight) / 2f
  return Rect(left.roundToInt(), top.roundToInt(), (left + sourceWidth).roundToInt(), (top + sourceHeight).roundToInt())
}

/** The measured brightness of the scrimmed quote band, as a flat grey. */
internal fun bandGrey(luminance: Double): Int { val channel = (luminance.coerceIn(0.0, 1.0) * 255).roundToInt(); return Color.rgb(channel, channel, channel) }
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

  fun layout(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): RotationLayout = measure(quote, preset, width, height).geometry
  internal fun staticQuoteLayout(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): StaticLayout = measure(quote, preset, width, height).staticLayout

  /** Every fitting candidate is a real StaticLayout; rendering retains the selected layout. */
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
    val desired = height * preset.quotePositionY.toFloat() - quoteHeight / 2f
    val maximumQuoteTop = max(topSafe, bottomSafe - quoteHeight - gap - authorHeight)
    val quoteTop = desired.coerceIn(topSafe, maximumQuoteTop)
    return MeasuredQuote(RotationLayout(left, quoteTop, right, quoteTop + quoteHeight, size.toFloat(), quoteTop + quoteHeight + gap, truncated, maxLines, quoteLayout.lineCount), quoteLayout)
  }
  /**
   * Draws the photograph over the flat band colour, then a scrim that peaks on
   * the quote and fades out well before either edge. A wash over the whole
   * frame would flatten the photograph; the quote only needs contrast where it
   * sits. A decode that fails leaves the flat colour, which is the measured
   * brightness of the scrimmed band, so the quote stays readable either way.
   */
  private fun drawPhotograph(canvas: Canvas, background: RotationBackground.Image, preset: RotationPreset, width: Int, height: Int) {
    val photograph = decode(background.asset, width, height) ?: return
    try {
      canvas.drawBitmap(photograph, coverSource(photograph.width, photograph.height, width, height), Rect(0, 0, width, height), Paint(Paint.FILTER_BITMAP_FLAG))
    } finally {
      photograph.recycle()
    }
    val clear = Color.parseColor(background.scrimColor) and 0x00FFFFFF
    val peak = clear or ((background.scrimOpacity * 255).roundToInt() shl 24)
    val scrim = Paint()
    scrim.shader = LinearGradient(0f, 0f, 0f, height.toFloat(), intArrayOf(clear, clear, peak, clear, clear), scrimStops(preset.quotePositionY), Shader.TileMode.CLAMP)
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), scrim)
  }

  /** Samples the photograph down to the wallpaper before it reaches memory. */
  private fun decode(asset: String, width: Int, height: Int): Bitmap? {
    val assets = assets ?: return null
    val path = "images/$asset"
    return try {
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      assets.open(path).use { BitmapFactory.decodeStream(it, null, bounds) }
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
      var sample = 1
      while (bounds.outWidth / (sample * 2) >= width && bounds.outHeight / (sample * 2) >= height) sample *= 2
      if (!WallpaperImageSafety.hasSafeRgbaAllocation(bounds.outWidth / sample, bounds.outHeight / sample)) return null
      assets.open(path).use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }) }
    } catch (_: Exception) {
      null
    }
  }

  fun render(quote: RotationQuote, preset: RotationPreset, width: Int, height: Int): Bitmap {
    require(WallpaperImageSafety.hasSafeRgbaAllocation(width, height)); val bitmap = resources.bitmapFactory(width, height)
    try {
      resources.afterAllocation(bitmap)
      val canvas = Canvas(bitmap); val paint = Paint(Paint.ANTI_ALIAS_FLAG)
      paint.shader = (preset.background as? RotationBackground.Gradient)?.let { gradient(it, width, height) }
      canvas.drawColor(when (val bg = preset.background) { is RotationBackground.Solid -> Color.parseColor(bg.color); is RotationBackground.Image -> bandGrey(bg.luminance); else -> Color.TRANSPARENT })
      if (paint.shader != null) canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
      (preset.background as? RotationBackground.Image)?.let { drawPhotograph(canvas, it, preset, width, height) }
      paint.shader = null
      preset.overlay?.let { canvas.drawColor(Color.parseColor(it)) }
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
  private fun quoteLayout(text: String, preset: RotationPreset, width: Float, size: Float, maxLines: Int?): StaticLayout {
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = typeface(preset); textSize = size; color = Color.parseColor(preset.textColor) }
    val alignment = when (preset.align) { "center" -> Layout.Alignment.ALIGN_CENTER; "right" -> Layout.Alignment.ALIGN_OPPOSITE; else -> Layout.Alignment.ALIGN_NORMAL }
    val targetLineHeight = size * preset.lineHeight.toFloat()
    val naturalLineHeight = paint.fontMetrics.descent - paint.fontMetrics.ascent
    return StaticLayout.Builder.obtain(text, 0, text.length, paint, width.toInt()).setAlignment(alignment).setIncludePad(false).setLineSpacing(skiaLeadingCorrection(targetLineHeight, naturalLineHeight), 1f).apply { if (maxLines != null) setMaxLines(maxLines).setEllipsize(android.text.TextUtils.TruncateAt.END).setEllipsizedWidth(width.toInt()) }.build()
  }
  /**
   * Skia lays a paragraph out from the float font metrics; StaticLayout uses
   * FontMetricsInt. The extra pixel absorbs that rounding difference, so a
   * Vietnamese tone mark never lands on the line above. Every bundled family
   * shares this path: the earlier Oswald-only correction went away with Oswald.
   */
  private fun skiaLeadingCorrection(targetLineHeight: Float, naturalLineHeight: Float): Float =
    targetLineHeight - naturalLineHeight + 1f
  private fun typeface(p: RotationPreset): Typeface = fonts["${p.family}-${p.weight}"] ?: assets?.let { runCatching { Typeface.createFromAsset(it, "fonts/${p.family}-${p.weight}.ttf") }.getOrElse { throw IllegalStateException("FONT_MISSING") } } ?: Typeface.DEFAULT
  internal fun gradientCoordinates(angle: Double, width: Int, height: Int): FloatArray { val radians = Math.toRadians(angle); val radius = hypot(width.toDouble(), height.toDouble()) / 2.0; val dx = cos(radians) * radius; val dy = sin(radians) * radius; return floatArrayOf((width / 2.0 - dx).toFloat(), (height / 2.0 - dy).toFloat(), (width / 2.0 + dx).toFloat(), (height / 2.0 + dy).toFloat()) }
  private fun gradient(bg: RotationBackground.Gradient, width: Int, height: Int): LinearGradient { val points = gradientCoordinates(bg.angle, width, height); return LinearGradient(points[0], points[1], points[2], points[3], Color.parseColor(bg.start), Color.parseColor(bg.end), Shader.TileMode.CLAMP) }
}
