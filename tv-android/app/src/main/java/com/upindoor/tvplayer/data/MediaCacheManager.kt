package com.upindoor.tvplayer.data

import android.content.Context
import android.net.Uri
import com.upindoor.tvplayer.model.TvRegionItemType
import com.upindoor.tvplayer.model.TvScreenManifest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class MediaCacheManager(context: Context) {
  private val appContext = context.applicationContext

  fun screenMediaDir(screenId: String): File {
    val safeId = screenId.replace(Regex("[^a-zA-Z0-9._-]"), "_")
    return File(appContext.filesDir, "up-indoor/media/$safeId").apply { mkdirs() }
  }

  fun cachedFile(screenId: String, itemId: String): File? {
    val dir = screenMediaDir(screenId)
    val prefix = safeItemId(itemId)
    return dir.listFiles()?.firstOrNull { file ->
      file.isFile && file.name.startsWith("$prefix.")
    }
  }

  fun resolvePlaybackUri(screenId: String, itemId: String, remoteSource: String?): Uri? {
    if (remoteSource.isNullOrBlank()) return null

    cachedFile(screenId, itemId)?.let { file ->
      if (file.length() > 0L) return Uri.fromFile(file)
    }

    if (remoteSource.startsWith("data:") || remoteSource.startsWith("file:")) {
      return Uri.parse(remoteSource)
    }

    return Uri.parse(remoteSource)
  }

  suspend fun prefetchForManifest(screenId: String, manifest: TvScreenManifest) {
    withContext(Dispatchers.IO) {
      val assets = collectMediaAssets(manifest)
      for ((itemId, url) in assets) {
        runCatching { ensureCached(screenId, itemId, url) }
      }
      prune(screenId, assets.map { it.first }.toSet())
    }
  }

  suspend fun ensureCached(screenId: String, itemId: String, url: String): File? {
    if (url.startsWith("data:")) return null

    cachedFile(screenId, itemId)?.takeIf { it.length() > 0L }?.let { return it }

    return withContext(Dispatchers.IO) {
      downloadToCache(screenId, itemId, url)
    }
  }

  fun prune(screenId: String, activeItemIds: Set<String>) {
    val dir = screenMediaDir(screenId)
    val activePrefixes = activeItemIds.map { safeItemId(it) }.toSet()
    dir.listFiles()?.forEach { file ->
      if (!file.isFile) return@forEach
      val prefix = file.name.substringBefore('.')
      if (prefix !in activePrefixes) {
        file.delete()
      }
    }
  }

  private fun collectMediaAssets(manifest: TvScreenManifest): List<Pair<String, String>> {
    return manifest.regions
      .flatMap { region -> region.items }
      .mapNotNull { item ->
        val source = item.source ?: return@mapNotNull null
        if (item.type != TvRegionItemType.IMAGE && item.type != TvRegionItemType.VIDEO) {
          return@mapNotNull null
        }
        if (source.startsWith("data:")) return@mapNotNull null
        item.id to source
      }
      .distinctBy { it.first }
  }

  private fun downloadToCache(screenId: String, itemId: String, url: String): File? {
    val connection =
      (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 60_000
        readTimeout = 120_000
        instanceFollowRedirects = true
        setRequestProperty("User-Agent", "UpIndoorTV/1.0")
      }

    return try {
      connection.inputStream.use { input ->
        val bytes = input.readBytes()
        if (bytes.isEmpty()) return null

        val extension = extensionFromUrl(url, connection.contentType)
        val file = File(screenMediaDir(screenId), "${safeItemId(itemId)}.$extension")
        val temp = File(file.parentFile, "${file.name}.part")
        temp.writeBytes(bytes)
        if (file.exists()) file.delete()
        if (!temp.renameTo(file)) {
          temp.copyTo(file, overwrite = true)
          temp.delete()
        }
        file
      }
    } finally {
      connection.disconnect()
    }
  }

  private fun extensionFromUrl(url: String, contentType: String?): String {
    val pathExt = url.substringBefore('?').substringAfterLast('.', "").lowercase()
    if (pathExt in MEDIA_EXTENSIONS) return pathExt

    return when ((contentType ?: "").lowercase()) {
      "image/png" -> "png"
      "image/jpeg", "image/jpg" -> "jpg"
      "image/webp" -> "webp"
      "image/gif" -> "gif"
      "video/mp4" -> "mp4"
      "video/webm" -> "webm"
      "video/quicktime" -> "mov"
      else -> "bin"
    }
  }

  private fun safeItemId(itemId: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(itemId.toByteArray())
    return digest.take(8).joinToString("") { byte -> "%02x".format(byte) }
  }

  companion object {
    private val MEDIA_EXTENSIONS = setOf("png", "jpg", "jpeg", "webp", "gif", "mp4", "webm", "mov")
  }
}
