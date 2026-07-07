package com.upindoor.tvplayer.ui

import android.content.Context
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer

object TvExoPlayerFactory {
  fun create(context: Context): ExoPlayer {
    val renderersFactory =
      DefaultRenderersFactory(context)
        .setEnableDecoderFallback(true)
        .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)

    return ExoPlayer.Builder(context, renderersFactory).build()
  }
}
