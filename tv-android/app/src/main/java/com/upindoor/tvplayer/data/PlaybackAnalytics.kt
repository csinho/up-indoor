package com.upindoor.tvplayer.data

import com.upindoor.tvplayer.model.TvDeviceSession
import com.upindoor.tvplayer.model.TvRegionItem
import com.upindoor.tvplayer.model.TvRegionItemType
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject

class PlaybackAnalytics(
  private val repository: TvManifestRepository = TvManifestRepository(),
) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  fun logEvent(
    session: TvDeviceSession,
    screenId: String,
    item: TvRegionItem?,
    eventType: String,
    message: String = "",
    meta: Map<String, Any?> = emptyMap(),
  ) {
    if (item == null) return
    if (!isTrackableItem(item)) return

    scope.launch {
      runCatching {
        repository.logPlayback(
          session = session,
          screenId = screenId,
          adId = item.id,
          eventType = eventType,
          message = message,
          meta =
            JSONObject()
              .put("itemType", item.type.name.lowercase())
              .put("title", item.title)
              .also { json ->
                meta.forEach { (key, value) ->
                  when (value) {
                    null -> Unit
                    is Number -> json.put(key, value)
                    is Boolean -> json.put(key, value)
                    else -> json.put(key, value.toString())
                  }
                }
              },
        )
      }
    }
  }

  private fun isTrackableItem(item: TvRegionItem): Boolean {
    return item.type == TvRegionItemType.IMAGE || item.type == TvRegionItemType.VIDEO
  }
}
