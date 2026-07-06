package com.upindoor.tvplayer.data

import android.content.Context
import com.upindoor.tvplayer.data.BackendConfig
import com.upindoor.tvplayer.model.TvDeviceSession
import java.util.UUID

class DeviceSessionStore(context: Context) {
  private val prefs =
    context.getSharedPreferences("up-indoor-tv-device", Context.MODE_PRIVATE)

  fun load(): TvDeviceSession {
    val deviceCode = prefs.getString(KEY_DEVICE_CODE, null) ?: buildDeviceCode().also {
      prefs.edit().putString(KEY_DEVICE_CODE, it).apply()
    }

    return TvDeviceSession(
      deviceCode = deviceCode,
      screenId = prefs.getString(KEY_SCREEN_ID, null),
      apiBaseUrl = prefs.getString(KEY_API_BASE_URL, null),
    )
  }

  fun save(screenId: String, apiBaseUrl: String? = null) {
    val normalizedBaseUrl =
      apiBaseUrl?.trim()?.takeIf { it.isNotBlank() }
        ?: BackendConfig.defaultBaseUrl

    prefs.edit()
      .putString(KEY_SCREEN_ID, screenId.trim())
      .putString(KEY_API_BASE_URL, normalizedBaseUrl)
      .apply()
  }

  fun clearPairing() {
    prefs.edit()
      .remove(KEY_SCREEN_ID)
      .remove(KEY_API_BASE_URL)
      .apply()
  }

  private fun buildDeviceCode(): String {
    return UUID.randomUUID()
      .toString()
      .replace("-", "")
      .take(8)
      .uppercase()
  }

  companion object {
    private const val KEY_DEVICE_CODE = "device_code"
    private const val KEY_SCREEN_ID = "screen_id"
    private const val KEY_API_BASE_URL = "api_base_url"
  }
}
