package com.upindoor.tvplayer.data

import android.content.Context
import com.upindoor.tvplayer.model.TvDeviceSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject

object TvHeartbeatScheduler {
  private const val HEARTBEAT_INTERVAL_MS = 10_000L

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var loopJob: Job? = null
  private val repository = TvManifestRepository()

  fun start(context: Context) {
    if (loopJob?.isActive == true) return

    loopJob =
      scope.launch {
        while (isActive) {
          sendHeartbeat(context.applicationContext, "periodic")
          delay(HEARTBEAT_INTERVAL_MS)
        }
      }
  }

  fun sendNow(context: Context, reason: String) {
    scope.launch {
      sendHeartbeat(context.applicationContext, reason)
    }
  }

  private suspend fun sendHeartbeat(context: Context, reason: String) {
    val sessionStore = DeviceSessionStore(context)
    val session = sessionStore.load()
    if (session.screenId.isNullOrBlank()) return

    val status = if (TvRuntimeState.isAppForeground()) "online" else "idle"
    val meta =
      JSONObject()
        .put("lifecycleEvent", reason)
        .put("appState", TvRuntimeState.appStateValue())
        .put("displayPower", TvRuntimeState.displayPowerValue())

    runCatching {
      repository.sendHeartbeat(
        session = session,
        status = status,
        meta = meta,
      )
    }
  }
}
