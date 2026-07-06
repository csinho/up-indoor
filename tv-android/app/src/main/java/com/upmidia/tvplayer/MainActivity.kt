package com.upmidia.tvplayer

import android.os.Bundle
import android.content.pm.ActivityInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import com.upmidia.tvplayer.data.DeviceSessionStore
import com.upmidia.tvplayer.data.TvManifestRepository
import com.upmidia.tvplayer.ui.UpIndoorTvApp
import com.upmidia.tvplayer.ui.theme.UpIndoorTvTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
  private val sessionStore by lazy { DeviceSessionStore(this) }
  private val repository by lazy { TvManifestRepository() }
  private var appliedOrientation: Int? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    appliedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    WindowCompat.setDecorFitsSystemWindows(window, false)

    setContent {
      UpIndoorTvTheme {
        UpIndoorTvApp()
      }
    }
  }

  override fun onStart() {
    super.onStart()
    sendHeartbeat("online", "activity_start")
  }

  override fun onStop() {
    sendHeartbeat("idle", "activity_stop")
    super.onStop()
  }

  private fun sendHeartbeat(status: String, lifecycleEvent: String) {
    val session = sessionStore.load()
    if (session.screenId.isNullOrBlank()) return

    lifecycleScope.launch {
      runCatching {
        repository.sendHeartbeat(
          session = session,
          status = status,
          meta = org.json.JSONObject().put("lifecycleEvent", lifecycleEvent),
        )
      }
    }
  }

  fun applyPlayerOrientation(isPortrait: Boolean) {
    val target = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE

    if (appliedOrientation != target || requestedOrientation != target) {
      appliedOrientation = target
      requestedOrientation = target
    }
  }
}
