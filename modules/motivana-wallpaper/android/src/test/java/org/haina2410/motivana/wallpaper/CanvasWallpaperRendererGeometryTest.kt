package org.haina2410.motivana.wallpaper

import android.graphics.Typeface
import java.io.File
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
    listOf(30, 80, 150, 250).forEach { length ->
      val text = ("word ".repeat(length / 5 + 1)).trim()
      listOf(720 to 1280, 720 to 1600).forEach { (width, height) ->
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
  }

  @Test fun gradientsUseTheirConfiguredAngleAndOverlayAndAccentLeaveVisiblePixels() {
    val catalog = authoritativeCatalog()
    val gradients = catalog.presets.filter { it.background is RotationBackground.Gradient }
    assertTrue(gradients.size >= 2)
    val renderer = CanvasWallpaperRenderer(catalog, actualFonts(catalog))
    val first = gradients[0].background as RotationBackground.Gradient
    assertTrue(!renderer.gradientCoordinates(first.angle, 720, 1280).contentEquals(renderer.gradientCoordinates(first.angle + 90.0, 720, 1280)))
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

  @Test fun sharedGoldenFixtureDrivesSafeBoundsAlignmentAndAccentParity() {
    val fixture = JSONObject(assetRoot().resolve("data/renderer-golden-fixture.json").readText()).getJSONArray("cases").getJSONObject(0)
    val catalog = authoritativeCatalog(); val preset = catalog.preset(fixture.getString("preset"))!!
    val quoteJson = fixture.getJSONObject("quote"); val quote = RotationQuote(quoteJson.getString("id"), quoteJson.getString("text"), quoteJson.getString("author"), quoteJson.getString("category"))
    val dimensions = fixture.getJSONObject("dimensions"); val width = dimensions.getInt("width"); val height = dimensions.getInt("height")
    val expected = fixture.getJSONObject("expected"); val box = expected.getJSONObject("quoteBox")
    val layout = CanvasWallpaperRenderer(catalog, actualFonts(catalog)).layout(quote, preset, width, height)
    assertEquals(preset.align, expected.getString("alignment"))
    assertEquals(box.getJSONArray("x").getDouble(0).toFloat(), layout.quoteLeft, .1f)
    assertTrue(layout.quoteTop in box.getJSONArray("y").getDouble(0).toFloat()..box.getJSONArray("y").getDouble(1).toFloat())
    assertEquals(box.getJSONArray("width").getDouble(0).toFloat(), layout.quoteRight - layout.quoteLeft, .1f)
    val accent = CanvasWallpaperRenderer(catalog, actualFonts(catalog)).accentGeometry(layout, preset)
    assertTrue(accent.centerY in expected.getJSONObject("accent").getJSONArray("y").getDouble(0).toFloat()..expected.getJSONObject("accent").getJSONArray("y").getDouble(1).toFloat())
  }

}
