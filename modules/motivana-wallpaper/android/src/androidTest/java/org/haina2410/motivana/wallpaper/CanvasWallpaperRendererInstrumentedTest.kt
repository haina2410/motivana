package org.haina2410.motivana.wallpaper

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import kotlin.math.abs
import org.junit.Test
import org.junit.runner.RunWith

/** Executes the production renderer and Android's real StaticLayout for every shared golden case. */
@RunWith(AndroidJUnit4::class)
class CanvasWallpaperRendererInstrumentedTest {
  @Test fun everySharedGoldenCaseStaysWithinTheExplicitCrossRendererTolerance() {
    val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    val catalog = RotationCatalogLoader.load(assets)
    val renderer = CanvasWallpaperRenderer(catalog, emptyMap(), assets)
    val fixture = JSONObject(assets.open("data/renderer-golden-fixture.json").bufferedReader().use { it.readText() })
    val exactTolerance = fixture.getDouble("layoutTolerance").toFloat()
    val tolerance = fixture.getJSONObject("crossRendererTolerance")
    val cases = fixture.getJSONArray("cases")
    for (index in 0 until cases.length()) {
      val item = cases.getJSONObject(index)
      val quoteJson = item.getJSONObject("quote")
      val quote = RotationQuote(quoteJson.getString("id"), soleFixtureText(quoteJson), if (quoteJson.isNull("author")) null else quoteJson.getString("author"), quoteJson.getString("category"))
      val preset = requireNotNull(catalog.preset(item.getString("preset")))
      val dimensions = item.getJSONObject("dimensions")
      val width = dimensions.getInt("width")
      val height = dimensions.getInt("height")
      val expected = item.getJSONObject("expected")
      val box = expected.getJSONObject("quoteBox")
      val layout = renderer.layout(quote, preset, width, height)
      val accent = renderer.accentGeometry(layout, preset)
      assertClose(item, "quote x", box.getDouble("x"), layout.quoteLeft, exactTolerance)
      assertWithin(item, "quote y", box.getDouble("y"), layout.quoteTop, tolerance.getDouble("quoteTop"))
      assertClose(item, "quote width", box.getDouble("width"), layout.quoteRight - layout.quoteLeft, exactTolerance)
      assertWithin(item, "quote height", box.getDouble("height"), layout.quoteBottom - layout.quoteTop, tolerance.getDouble("quoteHeight"))
      assertWithin(item, "font", expected.getDouble("fontSize"), layout.fontSize, tolerance.getDouble("fontSize"))
      assertTrue(item.getString("name"), abs(expected.getInt("lineCount") - layout.lineCount) <= tolerance.getInt("lineCount"))
      if (expected.getBoolean("truncated")) assertTrue(item.getString("name"), layout.maxLines != null) else assertNull(item.getString("name"), layout.maxLines)
      assertEquals(item.getString("name"), expected.getString("alignment"), preset.align)
      if (expected.isNull("authorY")) assertEquals(item.getString("name"), null, quote.author) else assertWithin(item, "author y", expected.getDouble("authorY"), layout.authorY, tolerance.getDouble("authorY"))
      assertEquals(item.getString("name"), expected.getBoolean("truncated"), layout.truncated)
      assertEquals(item.getString("name"), expected.getBoolean("ellipsis"), layout.truncated && layout.maxLines != null)
      val expectedAccent = expected.getJSONObject("accent")
      assertClose(item, "accent x", expectedAccent.getDouble("x"), accent.centerX, exactTolerance)
      assertWithin(item, "accent y", expectedAccent.getDouble("y"), accent.centerY, tolerance.getDouble("quoteTop"))
      assertClose(item, "accent radius", expectedAccent.getDouble("radius"), accent.radius, exactTolerance)
      assertEquals(item.getString("name"), width * .08f, layout.quoteLeft, exactTolerance)
      assertTrue("${item.getString("name")} exceeds top safe bound", layout.quoteTop >= height * .1f)
      assertTrue("${item.getString("name")} exceeds bottom safe bound", layout.quoteBottom <= height * .9f)
      val bitmap = renderer.render(quote, preset, width, height)
      assertEquals(width, bitmap.width)
      assertEquals(height, bitmap.height)
      assertFalse(bitmap.isRecycled)
      bitmap.recycle()
    }
  }

  private fun assertClose(item: JSONObject, field: String, expected: Double, actual: Float, tolerance: Float) {
    assertEquals("${item.getString("name")} $field", expected.toFloat(), actual, tolerance)
  }

  private fun assertWithin(item: JSONObject, field: String, expected: Double, actual: Float, tolerance: Double) {
    assertTrue("${item.getString("name")} $field expected $expected but was $actual", abs(expected - actual) <= tolerance)
  }

  @Test fun realStaticLayoutKeepsWideWordsAndUnicodeCompleteUntilControlledTruncation() {
    val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    val catalog = RotationCatalogLoader.load(assets)
    val renderer = CanvasWallpaperRenderer(catalog, emptyMap(), assets)
    val preset = requireNotNull(catalog.preset("midnight-focus"))
    listOf("ＭＷ".repeat(40), "pneumonoultramicroscopicsilicovolcanoconiosis".repeat(3)).forEach { text ->
      val quote = catalog.quotes.first().resolve(RotationLocales.DEFAULT).copy(text = text, author = "Author")
      val geometry = renderer.layout(quote, preset, 1080, 2400)
      val staticLayout = renderer.staticQuoteLayout(quote, preset, 1080, 2400)
      assertFalse(text, geometry.truncated)
      assertEquals(text, text.length, staticLayout.getLineEnd(staticLayout.lineCount - 1))
      assertTrue(text, (0 until staticLayout.lineCount).all { staticLayout.getEllipsisCount(it) == 0 })
    }
    val unicodeStress = catalog.quotes.first().resolve(RotationLocales.DEFAULT).copy(text = "🚀".repeat(2_000), author = "Author")
    val staticLayout = renderer.staticQuoteLayout(unicodeStress, preset, 1080, 2400)
    assertTrue((0 until staticLayout.lineCount).any { staticLayout.getEllipsisCount(it) > 0 })
  }

  /** Each golden case holds one language only. Read that single value. */
  private fun soleFixtureText(quoteJson: JSONObject): String {
    val texts = quoteJson.getJSONObject("text")
    assertEquals(quoteJson.getString("id"), 1, texts.length())
    return texts.getString(texts.keys().next())
  }
}
