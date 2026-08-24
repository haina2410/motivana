package org.haina2410.motivana.wallpaper

import android.graphics.Typeface
import android.graphics.Bitmap
import java.io.File
import kotlin.math.round
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class CanvasWallpaperRendererGeometryTest {
  private val quote = RotationQuote("q", "A quote deliberately repeated until it exercises the shared Task Four safe geometry and fitting rules without falling outside of the visible block. ".repeat(8), "Author")
  private val preset = RotationPreset("p", "Inter", "Regular", "center", .43, .064, .036, 1.18, "#FFFFFF", "#DDEEFF", RotationBackground.Gradient("#102A56", "#020617", 135.0))
  @Test fun fixtureRatiosKeepLongQuotesInsideEightAndTenPercentBounds() { listOf(1080 to 1920, 1080 to 2400).forEach { (width, height) -> val result = CanvasWallpaperRenderer(RotationCatalog(listOf(quote), listOf(preset)), emptyMap()).layout(quote, preset, width, height); assertTrue(result.quoteLeft >= width * .08f); assertTrue(result.quoteTop >= height * .1f); assertTrue(result.quoteBottom <= height * .9f); assertTrue(result.fontSize >= width * preset.minimumRatio) } }
  @Test fun allocationGuardRejectsMoreThanSixtyFourMebibytes() { assertTrue(!WallpaperImageSafety.hasSafeRgbaAllocation(5000, 5000)) }

  @Test fun recyclesAllocatedBitmapWhenPostAllocationRenderFails() {
    var allocated: Bitmap? = null
    val renderer = CanvasWallpaperRenderer(
      RotationCatalog(listOf(quote), listOf(preset)),
      emptyMap(),
      null,
      { width, height -> Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also { allocated = it } },
      { throw IllegalStateException("draw failure") },
    )
    try {
      renderer.render(quote, preset, 720, 1280)
      throw AssertionError("Expected draw failure")
    } catch (error: IllegalStateException) {
      assertEquals("draw failure", error.message)
    }
    assertTrue(requireNotNull(allocated).isRecycled)
  }

  @Test fun successfulRenderLeavesBitmapForPipelineOwnership() {
    val bitmap = CanvasWallpaperRenderer(RotationCatalog(listOf(quote), listOf(preset)), emptyMap()).render(quote, preset, 720, 1280)
    assertTrue(!bitmap.isRecycled)
    bitmap.recycle()
  }

  private fun authoritativeCatalog(): RotationCatalog {
    val root = assetRoot()
    val catalog = RotationCatalog(RotationCatalogLoader.parseQuotes(root.resolve("data/quotes.json").readText()), RotationCatalogLoader.parsePresets(root.resolve("data/presets.json").readText()))
    RotationCatalogValidator.validate(catalog)
    return catalog
  }
  private fun actualFonts(catalog: RotationCatalog): Map<String, Typeface> {
    val root = assetRoot().resolve("fonts")
    return catalog.presets.map { "${it.family}-${it.weight}" }.distinct().associateWith { name ->
      val file = root.resolve("$name.ttf"); assertTrue(file.isFile); Typeface.createFromFile(file)
    }
  }
  private fun assetRoot(): File = generateSequence(File(requireNotNull(System.getProperty("user.dir")))) { it.parentFile }
    .map { it.resolve("assets") }
    .first { it.resolve("data/quotes.json").isFile }

  @Test fun authoritativePresetFixtureRendersEveryFamilyWeightLengthAndRatioInsideSharedBounds() {
    val catalog = authoritativeCatalog()
    val renderer = CanvasWallpaperRenderer(catalog, actualFonts(catalog))
    listOf(30, 80, 150, 274).forEach { length ->
      val text = ("word ".repeat(length / 5 + 1)).trim()
      listOf(720 to 1280, 720 to 1600, 1080 to 2400).forEach { (width, height) ->
        catalog.presets.forEach { actual ->
          listOf(null, "Author").forEach { author ->
            val current = catalog.quotes.first().copy(text = text, author = author)
            val geometry = renderer.layout(current, actual, width, height)
            assertTrue(geometry.quoteLeft >= width * .08f)
            assertTrue(geometry.quoteTop >= height * .10f)
            assertTrue(geometry.quoteBottom <= height * .90f)
            val bitmap = renderer.render(current, actual, width, height)
            assertEquals(width, bitmap.width)
            assertEquals(height, bitmap.height)
            assertTrue(!bitmap.isRecycled)
            bitmap.recycle()
          }
        }
      }
    }
    catalog.presets.forEach { actual ->
      val stress = catalog.quotes.first().copy(text = "A".repeat(2_000), author = "Author")
      val geometry = renderer.layout(stress, actual, 1080, 2400)
      assertEquals(round(1080 * actual.minimumRatio).toFloat(), geometry.fontSize, .01f)
      assertTrue(geometry.truncated)
      assertTrue(requireNotNull(geometry.maxLines) > 0)
    }
  }

  // Mutation caught: measuring native geometry with StaticLayout rather than the
  // cross-renderer fitting contract makes preview/export and scheduled wallpaper
  // choose different sizes and safe boxes for the same composition.
  @Test fun nativeGeometryMatchesTheSharedForegroundContract() {
    val root = assetRoot()
    val catalog = authoritativeCatalog()
    val renderer = CanvasWallpaperRenderer(catalog, actualFonts(catalog))
    val fixture = JSONObject(root.resolve("data/renderer-golden-fixture.json").readText())
    val cases = fixture.getJSONArray("cases")
    for (index in 0 until cases.length()) {
      val item = cases.getJSONObject(index)
      val quoteJson = item.getJSONObject("quote")
      val quote = RotationQuote(
        quoteJson.getString("id"),
        quoteJson.getString("text"),
        if (quoteJson.isNull("author")) null else quoteJson.getString("author"),
        quoteJson.getString("category"),
      )
      val dimensions = item.getJSONObject("dimensions")
      val expected = item.getJSONObject("expected")
      val expectedBox = expected.getJSONObject("quoteBox")
      val actual = renderer.layout(
        quote,
        requireNotNull(catalog.preset(item.getString("preset"))),
        dimensions.getInt("width"),
        dimensions.getInt("height"),
      )

      assertEquals(item.getString("name"), expected.getDouble("fontSize").toFloat(), actual.fontSize, .01f)
      assertEquals(item.getString("name"), expectedBox.getDouble("y").toFloat(), actual.quoteTop, .01f)
      assertEquals(item.getString("name"), expectedBox.getDouble("height").toFloat(), actual.quoteBottom - actual.quoteTop, .01f)
      assertEquals(item.getString("name"), expected.getInt("lineCount"), actual.lineCount)
      assertEquals(item.getString("name"), expected.getBoolean("truncated"), actual.truncated)
    }
  }

  @Test fun gradientsUseTheirConfiguredAngleAndOverlayAndAccentLeaveVisiblePixels() {
    val catalog = authoritativeCatalog()
    val gradients = catalog.presets.filter { it.background is RotationBackground.Gradient }
    assertTrue(gradients.size >= 2)
    val renderer = CanvasWallpaperRenderer(catalog, actualFonts(catalog))
    val first = gradients[0].background as RotationBackground.Gradient
    assertTrue(!renderer.gradientCoordinates(first.angle, 720, 1280).contentEquals(renderer.gradientCoordinates(first.angle + 90.0, 720, 1280)))
    val vertical = renderer.gradientCoordinates(90.0, 1080, 1440)
    assertEquals(540f, vertical[0], .01f)
    assertEquals(-180f, vertical[1], .01f)
    assertEquals(540f, vertical[2], .01f)
    assertEquals(1620f, vertical[3], .01f)
    val one = renderer.render(catalog.quotes.first(), gradients[0], 720, 1280)
    val two = renderer.render(catalog.quotes.first(), gradients[1], 720, 1280)
    assertTrue(!one.isRecycled && !two.isRecycled)
    one.recycle(); two.recycle()
  }

  @Test fun taskFourAccentUsesRetainedQuoteBoundsForEveryAlignment() {
    val renderer = CanvasWallpaperRenderer(RotationCatalog(listOf(quote), listOf(preset)), emptyMap())
    val layout = RotationLayout(80f, 420f, 1000f, 600f, 48f, 630f, false)
    listOf("left", "center", "right").forEach { align ->
      val accent = renderer.accentGeometry(layout, preset.copy(align = align))
      val markSize = layout.fontSize * 1.5f
      val expectedX = if (align == "right") layout.quoteRight - markSize / 2f else layout.quoteLeft + markSize / 2f
      assertEquals(expectedX, accent.centerX, .001f)
      assertEquals(layout.quoteTop - markSize / 3f, accent.centerY, .001f)
      assertEquals(markSize / 10f, accent.radius, .001f)
    }
  }

  @Test fun sharedGoldenFixtureHasOneCompleteLiteralLayoutContract() {
    val root = JSONObject(assetRoot().resolve("data/renderer-golden-fixture.json").readText())
    assertTrue(root.getDouble("layoutTolerance") > 0)
    val cases = root.getJSONArray("cases")
    assertEquals(4, cases.length())
    var hasExtremeEllipsis = false
    for (index in 0 until cases.length()) {
      val item = cases.getJSONObject(index)
      val quote = item.getJSONObject("quote")
      val dimensions = item.getJSONObject("dimensions")
      assertTrue(quote.getString("text").isNotBlank())
      assertTrue(dimensions.getInt("width") > 0 && dimensions.getInt("height") > 0)
      val expected = item.getJSONObject("expected")
      val box = expected.getJSONObject("quoteBox")
      listOf("x", "y", "width", "height").forEach { key -> assertTrue(box.getDouble(key).isFinite()) }
      assertTrue(box.getDouble("width") > 0 && box.getDouble("height") > 0)
      assertTrue(expected.getDouble("fontSize") > 0)
      assertTrue(expected.getInt("lineCount") > 0)
      if (!expected.isNull("maxLines")) assertTrue(expected.getInt("maxLines") > 0)
      assertTrue(expected.getString("alignment") in setOf("left", "center", "right"))
      val accent = expected.getJSONObject("accent")
      listOf("x", "y", "radius").forEach { key -> assertTrue(accent.getDouble(key).isFinite()) }
      assertTrue(accent.getDouble("radius") > 0)
      assertEquals(expected.getBoolean("truncated"), expected.getBoolean("ellipsis"))
      if (item.getString("name") == "extreme-ellipsis-center-9x16") {
        hasExtremeEllipsis = true
        assertTrue(quote.getString("text").length in 1500..2500)
        assertTrue(quote.getString("text").contains(' '))
        assertTrue(expected.getBoolean("truncated"))
        assertTrue(expected.getBoolean("ellipsis"))
      }
    }
    assertTrue(hasExtremeEllipsis)
  }

}
