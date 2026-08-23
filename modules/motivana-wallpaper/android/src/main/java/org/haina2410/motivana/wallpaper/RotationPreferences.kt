package org.haina2410.motivana.wallpaper

import android.content.Context

class RotationPreferences(context: Context) {
  private val prefs = context.getSharedPreferences("motivana.wallpaper.automation", Context.MODE_PRIVATE)
  fun snapshot(catalog: RotationCatalog) = RotationSnapshot.parse(prefs.getString("snapshot", null), catalog)
  fun status() = RotationStatus.parse(prefs.getString("status", null))
  fun saveSnapshot(snapshot: RotationSnapshot): Boolean = prefs.edit().putString("snapshot", snapshot.toJson()).commit()
  fun saveStatus(status: RotationStatus): Boolean = prefs.edit().putString("status", status.toJson()).commit()
}
