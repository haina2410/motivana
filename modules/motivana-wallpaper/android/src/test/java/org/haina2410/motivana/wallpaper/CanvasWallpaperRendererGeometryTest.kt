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
  private val preset = RotationPreset("p", "BeVietnamPro", "Light", "center", .43, .064, .036, 1.18, "#FFFFFF", "#DDEEFF", RotationBackground.Gradient("#102A56", "#020617", 135.0))
  @Test fun fixtureRatiosKeepLongQuotesInsideEightAndTenPercentBounds() { listOf(1080 to 1920, 1080 to 2400).forEach { (width, height) -> val result = CanvasWallpaperRenderer(RotationCatalog(listOf(testEntry(quote)), listOf(preset)), emptyMap()).layout(quote, preset, width, height); assertTrue(result.quoteLeft >= width * .08f); assertTrue(result.quoteTop >= height * .1f); assertTrue(result.quoteBottom <= height * .9f); assertTrue(result.fontSize >= width * preset.minimumRatio) } }
  @Test fun allocationGuardRejectsMoreThanSixtyFourMebibytes() { assertTrue(!WallpaperImageSafety.hasSafeRgbaAllocation(5000, 5000)) }

  @Test fun recyclesAllocatedBitmapWhenPostAllocationRenderFails() {
    var allocated: Bitmap? = null
    val renderer = CanvasWallpaperRenderer(
      RotationCatalog(listOf(testEntry(quote)), listOf(preset)),
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
    val bitmap = CanvasWallpaperRenderer(RotationCatalog(listOf(testEntry(quote)), listOf(preset)), emptyMap()).render(quote, preset, 720, 1280)
    assertTrue(!bitmap.isRecycled)
    bitmap.recycle()
  }

  // Mutation caught: a scrim washed flat over the frame would grey out every
  // photograph, and stops out of order would make LinearGradient throw.
  @Test fun theScrimPeaksOnTheQuoteAndClearsBothEdges() {
    val stops = scrimStops(.468)
    assertEquals(listOf(0f, .048f, .468f, .888f, 1f), stops.map { round(it * 1000) / 1000 })
    // A quote near an edge clamps rather than running past the frame.
    listOf(.1, .9).forEach { centre ->
      val clamped = scrimStops(centre)
      assertTrue(clamped.toList() == clamped.sorted())
      assertEquals(0f, clamped.first(), 0f); assertEquals(1f, clamped.last(), 0f)
    }
  }

  // Mutation caught: filling the frame by stretching, rather than cropping the
  // longer side, would squash every photograph whose shape differs from the
  // phone's.
  @Test fun theSourceRectangleCoversTheCanvasWithoutDistortion() {
    // Same shape: the whole photograph.
    assertEquals(android.graphics.Rect(0, 0, 1290, 2796), coverSource(1290, 2796, 1290, 2796))
    // Wider than the canvas: the sides are cropped, the full height is kept.
    val cropped = coverSource(2000, 1000, 500, 1000)
    assertEquals(1000, cropped.height())
    assertEquals(500, cropped.width())
    assertEquals(cropped.left, 2000 - cropped.right)
  }

  // Mutation caught: a decode that fails leaves this colour behind the quote,
  // so a fixed grey would put white text on white for a bright photograph.
  @Test fun theFallbackColourIsTheMeasuredBandBrightness() {
    assertEquals(android.graphics.Color.rgb(66, 66, 66), bandGrey(.257))
    assertEquals(android.graphics.Color.rgb(255, 255, 255), bandGrey(1.4))
    assertEquals(android.graphics.Color.rgb(0, 0, 0), bandGrey(-.2))
  }

  // Mutation caught: parsing a photograph as a solid or dropping it entirely
  // would put a plain colour where the shipped catalogue promises an image.
  @Test fun theShippedCatalogueParsesItsPhotographsAsImageBackgrounds() {
    val catalog = authoritativeCatalog()
    val photographs = catalog.presets.mapNotNull { it.background as? RotationBackground.Image }
    assertTrue(photographs.size >= 40)
    assertTrue(photographs.all { it.asset.startsWith("backgrounds/") && it.asset.endsWith(".webp") })
    assertEquals(8, catalog.presets.size - photographs.size)
  }

  private fun authoritativeCatalog(): RotationCatalog {
    val root = assetRoot()
    val catalog = RotationCatalog(RotationCatalogLoader.parseQuotes(root.resolve("data/quotes.json").readText()), RotationCatalogLoader.parsePresets(root.resolve("data/backgrounds.json").readText()))
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
            val current = catalog.quotes.first().resolve(RotationLocales.DEFAULT).copy(text = text, author = author)
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
      val stress = catalog.quotes.first().resolve(RotationLocales.DEFAULT).copy(text = "A deliberate step\n".repeat(2_000), author = "Author")
      val geometry = renderer.layout(stress, actual, 1080, 2400)
      assertEquals(round(1080 * actual.minimumRatio).toFloat(), geometry.fontSize, .01f)
      assertTrue(geometry.truncated)
      assertTrue(requireNotNull(geometry.maxLines) > 0)
    }
  }

  // Robolectric does not shape our bundled fonts like a device. Keep its JVM check
  // to geometry invariants; device instrumentation below owns cross-engine parity.
  @Test fun nativeGeometryKeepsSharedHorizontalAndSafeBounds() {
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
        soleFixtureText(quoteJson),
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
      assertEquals(item.getString("name"), expectedBox.getDouble("x").toFloat(), actual.quoteLeft, .01f)
      assertEquals(item.getString("name"), expectedBox.getDouble("width").toFloat(), actual.quoteRight - actual.quoteLeft, .01f)
      assertTrue(item.getString("name"), actual.quoteTop >= dimensions.getInt("height") * .10f)
      assertTrue(item.getString("name"), actual.quoteBottom <= dimensions.getInt("height") * .90f)
      assertEquals(item.getString("name"), actual.truncated, actual.maxLines != null)
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
    val one = renderer.render(catalog.quotes.first().resolve(RotationLocales.DEFAULT), gradients[0], 720, 1280)
    val two = renderer.render(catalog.quotes.first().resolve(RotationLocales.DEFAULT), gradients[1], 720, 1280)
    assertTrue(!one.isRecycled && !two.isRecycled)
    one.recycle(); two.recycle()
  }

  // Mutation caught: applying a deterministic character-count maxLines to a
  // real StaticLayout can stop wide glyphs or unbroken words without ellipsis.
  @Test fun layoutOnlySetsMaxLinesAfterActualMinimumSizeTruncation() {
    val catalog = authoritativeCatalog()
    val renderer = CanvasWallpaperRenderer(catalog, actualFonts(catalog))
    val preset = requireNotNull(catalog.preset("midnight-focus"))
    listOf(
      "ＭＷ".repeat(40),
      "pneumonoultramicroscopicsilicovolcanoconiosis".repeat(3),
    ).forEachIndexed { index, text ->
      val quote = catalog.quotes.first().resolve(RotationLocales.DEFAULT).copy(id = "complete-$index", text = text, author = "Author")
      val geometry = renderer.layout(quote, preset, 1080, 2400)
      assertTrue(!geometry.truncated)
      assertEquals(null, geometry.maxLines)
    }
  }

  @Test fun taskFourAccentUsesRetainedQuoteBoundsForEveryAlignment() {
    val renderer = CanvasWallpaperRenderer(RotationCatalog(listOf(testEntry(quote)), listOf(preset)), emptyMap())
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
    assertEquals(8, cases.length())
    var hasExtremeEllipsis = false
    for (index in 0 until cases.length()) {
      val item = cases.getJSONObject(index)
      val quote = item.getJSONObject("quote")
      val dimensions = item.getJSONObject("dimensions")
      assertTrue(soleFixtureText(quote).isNotBlank())
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
        assertTrue(soleFixtureText(quote).length in 1500..2500)
        assertTrue(soleFixtureText(quote).contains(' '))
        assertTrue(expected.getBoolean("truncated"))
        assertTrue(expected.getBoolean("ellipsis"))
      }
    }
    assertTrue(hasExtremeEllipsis)
  }

  /** Each golden case holds one language only. Read that single value. */
  private fun soleFixtureText(quoteJson: JSONObject): String {
    val texts = quoteJson.getJSONObject("text")
    assertEquals(quoteJson.getString("id"), 1, texts.length())
    return texts.getString(texts.keys().next())
  }

}
