package org.haina2410.motivana.wallpaper

object RotationConfigureDecoder {
  fun decode(options: Map<String, Any?>): RotationSnapshot {
    val enabled = options["enabled"] as? Boolean ?: invalid()
    val randomize = options["randomizePreset"] as? Boolean ?: invalid()
    val favoritesOnly = options["favoriteQuotesOnly"] as? Boolean ?: invalid()
    val hours = options["intervalHours"] as? Number ?: invalid()
    if (hours.toDouble() % 1.0 != 0.0) invalid()
    val favorites = options["favoriteQuoteIds"] as? List<*> ?: invalid()
    if (favorites.any { it !is String || it.isBlank() }) invalid()
    val target = options["target"] as? String ?: invalid()
    val preset = options["selectedPresetId"] as? String ?: invalid()
    if (preset.isBlank()) invalid()
    return RotationSnapshot(enabled, hours.toInt(), try { WallpaperTarget.parse(target) } catch (_: Exception) { invalid() }, preset, randomize, favorites.filterIsInstance<String>(), favoritesOnly)
  }
  private fun invalid(): Nothing = throw IllegalArgumentException("INVALID_CONFIGURATION")
}
