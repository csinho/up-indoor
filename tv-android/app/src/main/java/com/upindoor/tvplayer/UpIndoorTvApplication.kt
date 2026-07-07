package com.upindoor.tvplayer

import android.app.Application
import android.content.Intent
import android.content.IntentFilter
import android.os.PowerManager
import com.upindoor.tvplayer.data.TvHeartbeatScheduler
import com.upindoor.tvplayer.data.TvRuntimeState

class UpIndoorTvApplication : Application() {
  private val displayPowerReceiver =
    object : android.content.BroadcastReceiver() {
      override fun onReceive(context: android.content.Context?, intent: Intent?) {
        when (intent?.action) {
          Intent.ACTION_SCREEN_ON -> {
            TvRuntimeState.setDisplayPower(true)
            TvHeartbeatScheduler.sendNow(applicationContext, "screen_on")
          }
          Intent.ACTION_SCREEN_OFF -> {
            TvRuntimeState.setDisplayPower(false)
            TvHeartbeatScheduler.sendNow(applicationContext, "screen_off")
          }
        }
      }
    }

  override fun onCreate() {
    super.onCreate()

    val powerManager = getSystemService(POWER_SERVICE) as PowerManager
    TvRuntimeState.setDisplayPower(powerManager.isInteractive)

    registerReceiver(
      displayPowerReceiver,
      IntentFilter().apply {
        addAction(Intent.ACTION_SCREEN_ON)
        addAction(Intent.ACTION_SCREEN_OFF)
      },
    )

    TvHeartbeatScheduler.start(this)
  }
}
