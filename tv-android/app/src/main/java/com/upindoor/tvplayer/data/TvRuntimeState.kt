package com.upindoor.tvplayer.data

import java.util.concurrent.atomic.AtomicBoolean

object TvRuntimeState {
  private val displayOn = AtomicBoolean(true)
  private val appForeground = AtomicBoolean(false)

  fun setDisplayPower(on: Boolean) {
    displayOn.set(on)
  }

  fun isDisplayOn(): Boolean = displayOn.get()

  fun setAppForeground(foreground: Boolean) {
    appForeground.set(foreground)
  }

  fun isAppForeground(): Boolean = appForeground.get()

  fun displayPowerValue(): String = if (displayOn.get()) "on" else "off"

  fun appStateValue(): String = if (appForeground.get()) "foreground" else "background"
}
