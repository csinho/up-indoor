package com.upmidia.tvplayer.ui

import com.upmidia.tvplayer.model.TvDisplayMode
import com.upmidia.tvplayer.model.TvOrientation
import com.upmidia.tvplayer.model.TvScreenManifest

/**
 * Android TV renderiza sempre em landscape (1920x1080).
 * Telas portrait (1080x1920) sao desenhadas num canvas logico retrato e giradas uma vez.
 */
data class TvContentLayout(
  val rotationDegrees: Float,
  val usePortraitCanvas: Boolean,
  val shouldCropMedia: Boolean,
)

fun resolveTvContentLayout(manifest: TvScreenManifest): TvContentLayout {
  val portraitScreen = manifest.orientation == TvOrientation.PORTRAIT

  return when (manifest.displayMode) {
    TvDisplayMode.ROTATE_90 ->
      TvContentLayout(
        rotationDegrees = 90f,
        usePortraitCanvas = true,
        shouldCropMedia = false,
      )

    TvDisplayMode.ROTATE_270 ->
      TvContentLayout(
        rotationDegrees = -90f,
        usePortraitCanvas = true,
        shouldCropMedia = false,
      )

    TvDisplayMode.FILL ->
      if (portraitScreen) {
        TvContentLayout(
          rotationDegrees = 90f,
          usePortraitCanvas = true,
          shouldCropMedia = false,
        )
      } else {
        TvContentLayout(
          rotationDegrees = 0f,
          usePortraitCanvas = false,
          shouldCropMedia = true,
        )
      }

    TvDisplayMode.NORMAL ->
      if (portraitScreen) {
        TvContentLayout(
          rotationDegrees = 90f,
          usePortraitCanvas = true,
          shouldCropMedia = false,
        )
      } else {
        TvContentLayout(
          rotationDegrees = 0f,
          usePortraitCanvas = false,
          shouldCropMedia = false,
        )
      }
  }
}
