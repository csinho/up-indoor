package com.upindoor.tvplayer

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import com.upindoor.tvplayer.data.DeviceSessionStore
import com.upindoor.tvplayer.data.TvManifestRepository
import com.upindoor.tvplayer.ui.UpIndoorTvApp
import com.upindoor.tvplayer.ui.theme.UpIndoorTvTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
  private val sessionStore by lazy { DeviceSessionStore(this) }
  private val repository by lazy { TvManifestRepository() }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Android TV: saida HDMI e sempre landscape; rotacao de conteudo portrait fica no Compose.
    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
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
}
