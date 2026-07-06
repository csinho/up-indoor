package com.upmidia.tvplayer.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val DarkColors =
  darkColorScheme(
    primary = TvPrimary,
    secondary = TvSecondary,
    background = TvBackground,
    surface = TvSurface,
  )

private val LightColors =
  lightColorScheme(
    primary = TvPrimary,
    secondary = TvSecondary,
    background = TvBackground,
    surface = TvSurface,
  )

@Composable
fun UpIndoorTvTheme(content: @Composable () -> Unit) {
  val colors = if (isSystemInDarkTheme()) DarkColors else LightColors

  MaterialTheme(
    colorScheme = colors,
    content = content,
  )
}
