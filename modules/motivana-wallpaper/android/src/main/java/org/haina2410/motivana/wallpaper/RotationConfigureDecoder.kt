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
    val originalHours = hours.toDouble()
    if (!originalHours.isFinite() || originalHours !in Int.MIN_VALUE.toDouble()..Int.MAX_VALUE.toDouble()) invalid()
    val exactHours = hours.toLong()
    if (originalHours != exactHours.toDouble() || exactHours !in setOf(6L, 12L, 24L)) invalid()
    // An unknown or absent language falls back instead of failing. An over-the-air JS
    // update can be older than this native module, and a failed decode stops rotation.
    val locale = (options["contentLocale"] as? String)?.takeIf { it in RotationLocales.supported } ?: RotationLocales.DEFAULT
    return RotationSnapshot(enabled, exactHours.toInt(), try { WallpaperTarget.parse(target) } catch (_: Exception) { invalid() }, preset, randomize, favorites.filterIsInstance<String>(), favoritesOnly, contentLocale = locale)
  }
  private fun invalid(): Nothing = throw IllegalArgumentException("INVALID_CONFIGURATION")
}
