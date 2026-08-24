package org.haina2410.motivana.wallpaper

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Executes the production renderer and Android's real StaticLayout for every shared golden case. */
@RunWith(AndroidJUnit4::class)
class CanvasWallpaperRendererInstrumentedTest {
  @Test fun everySharedGoldenCaseMatchesTheCanonicalLayoutContract() {
    val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    val catalog = RotationCatalogLoader.load(assets)
    val renderer = CanvasWallpaperRenderer(catalog, emptyMap(), assets)
    val fixture = JSONObject(assets.open("data/renderer-golden-fixture.json").bufferedReader().use { it.readText() })
    val tolerance = fixture.getDouble("layoutTolerance").toFloat()
    val cases = fixture.getJSONArray("cases")
    for (index in 0 until cases.length()) {
      val item = cases.getJSONObject(index)
      val quoteJson = item.getJSONObject("quote")
      val quote = RotationQuote(quoteJson.getString("id"), quoteJson.getString("text"), if (quoteJson.isNull("author")) null else quoteJson.getString("author"), quoteJson.getString("category"))
      val preset = requireNotNull(catalog.preset(item.getString("preset")))
      val dimensions = item.getJSONObject("dimensions")
      val width = dimensions.getInt("width")
      val height = dimensions.getInt("height")
      val expected = item.getJSONObject("expected")
      val box = expected.getJSONObject("quoteBox")
      val layout = renderer.layout(quote, preset, width, height)
      val accent = renderer.accentGeometry(layout, preset)
      assertClose(item, "quote x", box.getDouble("x"), layout.quoteLeft, tolerance)
      assertClose(item, "quote y", box.getDouble("y"), layout.quoteTop, tolerance)
      assertClose(item, "quote width", box.getDouble("width"), layout.quoteRight - layout.quoteLeft, tolerance)
      assertClose(item, "quote height", box.getDouble("height"), layout.quoteBottom - layout.quoteTop, tolerance)
      assertClose(item, "font", expected.getDouble("fontSize"), layout.fontSize, tolerance)
      assertEquals(item.getString("name"), expected.getInt("lineCount"), layout.lineCount)
      if (expected.isNull("maxLines")) assertNull(item.getString("name"), layout.maxLines) else assertEquals(item.getString("name"), expected.getInt("maxLines"), layout.maxLines)
      assertEquals(item.getString("name"), expected.getString("alignment"), preset.align)
      if (expected.isNull("authorY")) assertEquals(item.getString("name"), null, quote.author) else assertClose(item, "author y", expected.getDouble("authorY"), layout.authorY, tolerance)
      assertEquals(item.getString("name"), expected.getBoolean("truncated"), layout.truncated)
      assertEquals(item.getString("name"), expected.getBoolean("ellipsis"), layout.truncated && layout.maxLines != null)
      val expectedAccent = expected.getJSONObject("accent")
      assertClose(item, "accent x", expectedAccent.getDouble("x"), accent.centerX, tolerance)
      assertClose(item, "accent y", expectedAccent.getDouble("y"), accent.centerY, tolerance)
      assertClose(item, "accent radius", expectedAccent.getDouble("radius"), accent.radius, tolerance)
      assertEquals(item.getString("name"), width * .08f, layout.quoteLeft, tolerance)
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
}
