package com.upindoor.tvplayer.data

import android.content.Context
import org.json.JSONObject
import java.io.File

data class CachedManifest(
  val rawJson: String,
  val playlistVersion: Long,
  val syncedAt: Long,
)

class ManifestCacheStore(context: Context) {
  private val rootDir =
    File(context.filesDir, "up-indoor/manifests").apply { mkdirs() }

  fun save(screenId: String, rawJson: String, playlistVersion: Long) {
    val payload =
      JSONObject()
        .put("rawJson", rawJson)
        .put("playlistVersion", playlistVersion)
        .put("syncedAt", System.currentTimeMillis())

    manifestFile(screenId).writeText(payload.toString())
  }

  fun load(screenId: String): CachedManifest? {
    val file = manifestFile(screenId)
    if (!file.exists()) return null

    return try {
      val payload = JSONObject(file.readText())
      CachedManifest(
        rawJson = payload.getString("rawJson"),
        playlistVersion = payload.optLong("playlistVersion", 1L),
        syncedAt = payload.optLong("syncedAt", file.lastModified()),
      )
    } catch (_: Exception) {
      null
    }
  }

  fun clear(screenId: String) {
    manifestFile(screenId).delete()
  }

  private fun manifestFile(screenId: String): File {
    val safeId = screenId.replace(Regex("[^a-zA-Z0-9._-]"), "_")
    return File(rootDir, "$safeId.json")
  }
}
