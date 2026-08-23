package org.haina2410.motivana.wallpaper

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
}
