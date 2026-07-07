package com.upindoor.tvplayer.data

import android.os.Build
import com.upindoor.tvplayer.BuildConfig
import com.upindoor.tvplayer.data.TvRuntimeState
import com.upindoor.tvplayer.model.TvDeviceSession
import com.upindoor.tvplayer.model.TvDisplayMode
import com.upindoor.tvplayer.model.TvLayoutRegion
import com.upindoor.tvplayer.model.TvOrientation
import com.upindoor.tvplayer.model.TvRegionItem
import com.upindoor.tvplayer.model.TvRegionItemType
import com.upindoor.tvplayer.model.TvRegionType
import com.upindoor.tvplayer.model.TvScreenManifest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class TvBootstrapResult(
  val deviceCode: String,
  val paired: Boolean,
  val screenId: String?,
  val status: String,
  val qrPayload: String?,
)

data class TvPairingStatusResult(
  val paired: Boolean,
  val screenId: String?,
  val status: String,
)

class TvBackendException(
  val statusCode: Int,
  val errorCode: String?,
  override val message: String,
) : IllegalStateException(message)

class TvManifestRepository {
  suspend fun bootstrapDevice(session: TvDeviceSession): TvBootstrapResult {
    return withContext(Dispatchers.IO) {
      val baseUrl = normalizeBaseUrl(session.apiBaseUrl)
      val payload =
        JSONObject()
          .put("deviceCode", session.deviceCode)
          .put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
          .put("platform", "android_tv")
          .put("appVersion", BuildConfig.VERSION_NAME)
          .put("osVersion", Build.VERSION.RELEASE ?: "unknown")

      val json = postJson("$baseUrl/functions/v1/tv-device-bootstrap", payload)
      TvBootstrapResult(
        deviceCode = json.getString("deviceCode"),
        paired = json.optBoolean("paired", false),
        screenId = json.optString("screenId").ifBlank { null },
        status = json.optString("status", "pending"),
        qrPayload = json.optString("qrPayload").ifBlank { null },
      )
    }
  }

  suspend fun getPairingStatus(session: TvDeviceSession): TvPairingStatusResult {
    return withContext(Dispatchers.IO) {
      val baseUrl = normalizeBaseUrl(session.apiBaseUrl)
      val payload = JSONObject().put("deviceCode", session.deviceCode)
      val json = postJson("$baseUrl/functions/v1/tv-pairing-status", payload)
      TvPairingStatusResult(
        paired = json.optBoolean("paired", false),
        screenId = json.optString("screenId").ifBlank { null },
        status = json.optString("status", "pending"),
      )
    }
  }

  suspend fun syncDeviceAndLoadManifest(session: TvDeviceSession): TvScreenManifest {
    return parseManifest(syncDeviceAndFetchManifestJson(session))
  }

  suspend fun syncDeviceAndFetchManifestJson(session: TvDeviceSession): JSONObject {
    return withContext(Dispatchers.IO) {
      val baseUrl = normalizeBaseUrl(session.apiBaseUrl)
      registerDevice(baseUrl, session)
      fetchManifestJson(baseUrl, session.deviceCode)
    }
  }

  suspend fun loadManifest(session: TvDeviceSession): TvScreenManifest {
    return parseManifest(fetchManifestJson(session))
  }

  suspend fun fetchManifestJson(session: TvDeviceSession): JSONObject {
    return withContext(Dispatchers.IO) {
      val baseUrl = normalizeBaseUrl(session.apiBaseUrl)
      fetchManifestJson(baseUrl, session.deviceCode)
    }
  }

  suspend fun sendHeartbeat(
    session: TvDeviceSession,
    status: String,
    playlistVersion: Long? = null,
    meta: JSONObject? = null,
  ) {
    return withContext(Dispatchers.IO) {
      val baseUrl = normalizeBaseUrl(session.apiBaseUrl)
      val payload =
        JSONObject()
          .put("deviceCode", session.deviceCode)
          .put("screenId", session.screenId)
          .put("status", status)
          .put("networkState", "online")

      if (playlistVersion != null) {
        payload.put("playlistVersion", playlistVersion)
      }

      if (meta != null) {
        payload.put("meta", meta)
      }

      payload
        .put(
          "appState",
          meta?.optString("appState")?.ifBlank { null } ?: TvRuntimeState.appStateValue(),
        )
        .put(
          "displayPower",
          meta?.optString("displayPower")?.ifBlank { null } ?: TvRuntimeState.displayPowerValue(),
        )

      postJson("$baseUrl/functions/v1/tv-device-heartbeat", payload)
    }
  }

  suspend fun logPlayback(
    session: TvDeviceSession,
    screenId: String,
    adId: String,
    eventType: String,
    message: String = "",
    meta: JSONObject? = null,
  ) {
    return withContext(Dispatchers.IO) {
      val baseUrl = normalizeBaseUrl(session.apiBaseUrl)
      val payload =
        JSONObject()
          .put("deviceCode", session.deviceCode)
          .put("screenId", screenId)
          .put("adId", adId)
          .put("eventType", eventType)
          .put("message", message)

      if (meta != null) {
        payload.put("meta", meta)
      }

      postJson("$baseUrl/functions/v1/tv-log-playback", payload)
    }
  }

  private fun registerDevice(baseUrl: String, session: TvDeviceSession) {
    val payload =
      JSONObject()
        .put("deviceCode", session.deviceCode)
        .put("screenId", session.screenId)
        .put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
        .put("platform", "android_tv")
        .put("appVersion", BuildConfig.VERSION_NAME)
        .put("osVersion", Build.VERSION.RELEASE ?: "unknown")

    postJson("$baseUrl/functions/v1/tv-register-device", payload)
  }

  private fun fetchManifestJson(baseUrl: String, deviceCode: String): JSONObject {
    val payload =
      JSONObject()
        .put("deviceCode", deviceCode)
        .put("appState", com.upindoor.tvplayer.data.TvRuntimeState.appStateValue())
        .put("displayPower", com.upindoor.tvplayer.data.TvRuntimeState.displayPowerValue())
    return postJson("$baseUrl/functions/v1/tv-player-manifest", payload)
  }

  private fun postJson(url: String, body: JSONObject): JSONObject {
    val connection = (URL(url).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 30_000
      readTimeout = 30_000
      doOutput = true
      setRequestProperty("Content-Type", "application/json")
      setRequestProperty("apikey", BackendConfig.publishableKey)
      setRequestProperty("Authorization", "Bearer ${BackendConfig.publishableKey}")
    }

    connection.outputStream.use { output ->
      output.write(body.toString().toByteArray())
    }

    val stream =
      if (connection.responseCode in 200..299) {
        connection.inputStream
      } else {
        connection.errorStream
      }

    val response =
      stream.use { input ->
        BufferedReader(InputStreamReader(input)).readText()
      }

    val json = JSONObject(response.ifBlank { "{}" })
    if (connection.responseCode !in 200..299) {
      throw TvBackendException(
        statusCode = connection.responseCode,
        errorCode = json.optString("error").ifBlank { null },
        message =
          json.optString("message").ifBlank {
            "HTTP ${connection.responseCode} while calling $url"
          },
      )
    }

    return json
  }

  fun parseManifest(json: JSONObject): TvScreenManifest {
    return TvScreenManifest(
      screenId = json.getString("screenId"),
      screenName = json.optString("screenName", json.getString("screenId")),
      screenLocation = json.optString("screenLocation", ""),
      storeName = json.optString("storeName", ""),
      deviceCode = json.optString("deviceCode", ""),
      orientation =
        if (json.optString("orientation") == "portrait") {
          TvOrientation.PORTRAIT
        } else {
          TvOrientation.LANDSCAPE
        },
      displayMode =
        when (json.optString("displayMode", "normal")) {
          "rotate_90" -> TvDisplayMode.ROTATE_90
          "rotate_270" -> TvDisplayMode.ROTATE_270
          "fill" -> TvDisplayMode.FILL
          else -> TvDisplayMode.NORMAL
        },
      playlistVersion = json.optLong("playlistVersion", 1L),
      canvasWidth = json.optInt("canvasWidth", 1920),
      canvasHeight = json.optInt("canvasHeight", 1080),
      regions = parseRegions(json.optJSONArray("regions") ?: JSONArray()),
    )
  }

  private fun parseRegions(jsonArray: JSONArray): List<TvLayoutRegion> {
    return buildList {
      for (index in 0 until jsonArray.length()) {
        val region = jsonArray.getJSONObject(index)
        add(
          TvLayoutRegion(
            id = region.getString("id"),
            name = region.optString("name", "Regiao ${index + 1}"),
            type =
              if (region.optString("type") == "banner") {
                TvRegionType.BANNER
              } else {
                TvRegionType.MEDIA
              },
            x = region.optInt("x", 0),
            y = region.optInt("y", 0),
            width = region.optInt("width", 1),
            height = region.optInt("height", 1),
            zIndex = region.optInt("zIndex", 1),
            backgroundHex = region.optString("backgroundHex", "#111827"),
            items = parseItems(region.optJSONArray("items") ?: JSONArray()),
          ),
        )
      }
    }
  }

  private fun parseItems(jsonArray: JSONArray): List<TvRegionItem> {
    return buildList {
      for (index in 0 until jsonArray.length()) {
        val item = jsonArray.getJSONObject(index)
        add(
          TvRegionItem(
            id = item.getString("id"),
            type =
              when (item.optString("type")) {
                "image" -> TvRegionItemType.IMAGE
                "banner" -> TvRegionItemType.BANNER
                else -> TvRegionItemType.VIDEO
              },
            title = item.optString("title", "Item ${index + 1}"),
            source = item.optString("source").ifBlank { null },
            bannerText = item.optString("bannerText").ifBlank { null },
            backgroundHex = item.optString("backgroundHex", "#111827"),
            textHex = item.optString("textHex", "#FFFFFF"),
            durationSeconds = item.optInt("durationSeconds", 15),
          ),
        )
      }
    }
  }

  private fun normalizeBaseUrl(baseUrl: String?): String {
    return (baseUrl?.trim()?.ifBlank { null } ?: BackendConfig.defaultBaseUrl)
      .removeSuffix("/")
  }
}
