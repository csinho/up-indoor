package com.upindoor.tvplayer

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import com.upindoor.tvplayer.data.TvHeartbeatScheduler
import com.upindoor.tvplayer.data.TvRuntimeState
import com.upindoor.tvplayer.ui.UpIndoorTvApp
import com.upindoor.tvplayer.ui.theme.UpIndoorTvTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
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
    TvRuntimeState.setAppForeground(true)
    TvHeartbeatScheduler.sendNow(applicationContext, "activity_start")
  }

  override fun onStop() {
    TvRuntimeState.setAppForeground(false)
    TvHeartbeatScheduler.sendNow(applicationContext, "activity_stop")
    super.onStop()
  }
}
