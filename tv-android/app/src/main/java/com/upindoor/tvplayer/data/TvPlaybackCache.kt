package com.upindoor.tvplayer.data

import com.upindoor.tvplayer.model.TvDeviceSession
import com.upindoor.tvplayer.model.TvScreenManifest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject

data class ManifestLoadResult(
  val manifest: TvScreenManifest,
  val isOffline: Boolean,
  val lastSyncedAt: Long?,
)

class TvPlaybackCache(
  context: android.content.Context,
) {
  private val manifestStore = ManifestCacheStore(context)
  private val mediaCache = MediaCacheManager(context)
  private val repository = TvManifestRepository()
  private val prefetchScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  suspend fun loadManifest(
    session: TvDeviceSession,
    registerDevice: Boolean,
  ): ManifestLoadResult {
    val screenId = session.screenId ?: error("screenId is required")

    return try {
      val json =
        if (registerDevice) {
          repository.syncDeviceAndFetchManifestJson(session)
        } else {
          repository.fetchManifestJson(session)
        }

      val manifest = repository.parseManifest(json)
      val syncedAt = System.currentTimeMillis()
      manifestStore.save(screenId, json.toString(), manifest.playlistVersion)

      prefetchScope.launch {
        mediaCache.prefetchForManifest(screenId, manifest)
      }

      ManifestLoadResult(
        manifest = manifest,
        isOffline = false,
        lastSyncedAt = syncedAt,
      )
    } catch (error: Throwable) {
      if (!canFallbackToCache(error)) throw error

      val cached = manifestStore.load(screenId) ?: throw error
      val manifest = repository.parseManifest(JSONObject(cached.rawJson))

      ManifestLoadResult(
        manifest = manifest,
        isOffline = true,
        lastSyncedAt = cached.syncedAt,
      )
    }
  }

  fun media(): MediaCacheManager = mediaCache

  fun loadCachedOnly(session: TvDeviceSession): ManifestLoadResult? {
    val screenId = session.screenId ?: return null
    val cached = manifestStore.load(screenId) ?: return null
    val manifest = repository.parseManifest(JSONObject(cached.rawJson))
    return ManifestLoadResult(
      manifest = manifest,
      isOffline = true,
      lastSyncedAt = cached.syncedAt,
    )
  }

  private fun canFallbackToCache(error: Throwable): Boolean {
    if (error is TvBackendException) {
      return when (error.errorCode) {
        "screen_inactive",
        "device_not_paired",
        "device_not_registered",
        "invalid_device_code",
        -> false
        else -> error.statusCode >= 500 || error.statusCode == 503
      }
    }
    return true
  }
}
