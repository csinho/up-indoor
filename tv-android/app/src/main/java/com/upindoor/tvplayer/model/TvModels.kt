package com.upindoor.tvplayer.model

enum class TvOrientation {
  LANDSCAPE,
  PORTRAIT,
}

enum class TvDisplayMode {
  NORMAL,
  ROTATE_90,
  ROTATE_270,
  FILL,
}

enum class TvRegionType {
  MEDIA,
  BANNER,
}

enum class TvRegionItemType {
  VIDEO,
  IMAGE,
  BANNER,
}

data class TvDeviceSession(
  val deviceCode: String,
  val screenId: String?,
  val apiBaseUrl: String?,
)

data class TvScreenManifest(
  val screenId: String,
  val screenName: String,
  val orientation: TvOrientation,
  val displayMode: TvDisplayMode,
  val playlistVersion: Long,
  val canvasWidth: Int,
  val canvasHeight: Int,
  val regions: List<TvLayoutRegion>,
)

data class TvLayoutRegion(
  val id: String,
  val name: String,
  val type: TvRegionType,
  val x: Int,
  val y: Int,
  val width: Int,
  val height: Int,
  val zIndex: Int,
  val backgroundHex: String = "#111827",
  val items: List<TvRegionItem>,
)

data class TvRegionItem(
  val id: String,
  val type: TvRegionItemType,
  val title: String,
  val source: String? = null,
  val bannerText: String? = null,
  val backgroundHex: String = "#111827",
  val textHex: String = "#FFFFFF",
  val durationSeconds: Int = 15,
)
