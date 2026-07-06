package com.upmidia.tvplayer.ui

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Color.parseColor
import android.net.Uri
import android.util.Base64
import android.view.TextureView
import androidx.activity.ComponentActivity
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.upmidia.tvplayer.data.BackendConfig
import com.upmidia.tvplayer.data.DeviceSessionStore
import com.upmidia.tvplayer.data.TvBackendException
import com.upmidia.tvplayer.data.TvManifestRepository
import com.upmidia.tvplayer.model.TvDeviceSession
import com.upmidia.tvplayer.model.TvLayoutRegion
import com.upmidia.tvplayer.model.TvRegionItem
import com.upmidia.tvplayer.model.TvRegionItemType
import com.upmidia.tvplayer.model.TvRegionType
import com.upmidia.tvplayer.model.TvScreenManifest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder

private const val MANIFEST_REFRESH_INTERVAL_MS = 15_000L

private data class DataUriPayload(
  val mimeType: String,
  val bytes: ByteArray,
)

private data class ImageLoadResult(
  val bitmap: ImageBitmap?,
  val error: String? = null,
)

@Composable
fun UpIndoorTvApp() {
  val context = LocalContext.current
  val sessionStore = remember { DeviceSessionStore(context) }
  var session by remember { mutableStateOf(sessionStore.load()) }

  Surface(
    modifier = Modifier.fillMaxSize(),
    color = MaterialTheme.colorScheme.background,
  ) {
    if (session.screenId.isNullOrBlank()) {
      ActivationScreen(
        session = session,
        onActivate = { screenId, apiBaseUrl ->
          sessionStore.save(screenId, apiBaseUrl)
          session = sessionStore.load()
        },
      )
    } else {
      TvPlayerRoute(
        session = session,
        onResetPairing = {
          sessionStore.clearPairing()
          session = sessionStore.load()
        },
      )
    }
  }
}

private sealed interface ManifestUiState {
  data object Loading : ManifestUiState

  data class Ready(val manifest: TvScreenManifest) : ManifestUiState

  data class Error(val message: String) : ManifestUiState
}

private fun shouldStopPlaybackForError(error: Throwable): Boolean {
  if (error !is TvBackendException) return false

  return when (error.errorCode) {
    "screen_inactive",
    "device_not_paired",
    "device_not_registered",
    -> true
    else -> false
  }
}

@Composable
private fun ActivationScreen(
  session: TvDeviceSession,
  onActivate: (screenId: String, apiBaseUrl: String?) -> Unit,
) {
  var screenId by remember { mutableStateOf("tv") }
  var apiBaseUrl by remember { mutableStateOf(BackendConfig.defaultBaseUrl) }
  val fieldColors =
    OutlinedTextFieldDefaults.colors(
      focusedTextColor = Color.White,
      unfocusedTextColor = Color.White,
      focusedLabelColor = Color(0xFF67E8F9),
      unfocusedLabelColor = Color(0xFFCBD5E1),
      focusedPlaceholderColor = Color(0xFF64748B),
      unfocusedPlaceholderColor = Color(0xFF64748B),
      cursorColor = Color(0xFF67E8F9),
      focusedBorderColor = Color(0xFF22D3EE),
      unfocusedBorderColor = Color(0xFF475569),
    )

  Box(
    modifier =
      Modifier
        .fillMaxSize()
        .background(Color(0xFF020617)),
    contentAlignment = Alignment.TopCenter,
  ) {
    Card(
      colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
      shape = RoundedCornerShape(24.dp),
      modifier =
        Modifier
          .fillMaxWidth(0.9f)
          .padding(top = 24.dp),
    ) {
      Column(
        modifier = Modifier.padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
      ) {
        Text(
          text = "Ativacao da TV",
          style = MaterialTheme.typography.headlineSmall,
          color = Color.White,
        )
        Text(
          text = "Digite o Screen ID da TV cadastrada no dashboard e toque em ativar.",
          color = Color(0xFFCBD5E1),
          lineHeight = 20.sp,
        )

        Card(
          colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
        ) {
          Column(modifier = Modifier.padding(16.dp)) {
            Text(
              text = "Codigo do dispositivo",
              color = Color(0xFF94A3B8),
              fontSize = 14.sp,
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
              text = session.deviceCode,
              color = Color.White,
              fontSize = 24.sp,
              fontWeight = FontWeight.Bold,
            )
          }
        }

        OutlinedTextField(
          value = screenId,
          onValueChange = { screenId = it },
          label = { Text("screenId para desenvolvimento") },
          placeholder = { Text("Ex.: tv") },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
          colors = fieldColors,
        )

        OutlinedTextField(
          value = apiBaseUrl,
          onValueChange = { apiBaseUrl = it },
          label = { Text("Base URL do backend") },
          placeholder = { Text("https://seu-projeto.supabase.co") },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
          colors = fieldColors,
        )

        Text(
          text = "Use o Screen ID mostrado no dashboard. A URL pode continuar assim neste ambiente.",
          color = Color(0xFF94A3B8),
          fontSize = 13.sp,
          lineHeight = 18.sp,
        )

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          val activateInteractionSource = remember { MutableInteractionSource() }
          val isActivateFocused by activateInteractionSource.collectIsFocusedAsState()

          Button(
            onClick = {
              if (screenId.isNotBlank()) onActivate(screenId, apiBaseUrl)
            },
            modifier = Modifier.fillMaxWidth(),
            interactionSource = activateInteractionSource,
            shape = RoundedCornerShape(14.dp),
            colors =
              ButtonDefaults.buttonColors(
                containerColor =
                  if (isActivateFocused) {
                    Color(0xFF22D3EE)
                  } else {
                    Color(0xFF6366F1)
                  },
                contentColor =
                  if (isActivateFocused) {
                    Color(0xFF020617)
                  } else {
                    Color.White
                  },
              ),
            border =
              if (isActivateFocused) {
                BorderStroke(4.dp, Color.White)
              } else {
                BorderStroke(1.dp, Color(0xFF475569))
              },
          ) {
            Text(
              text = "Ativar nesta TV",
              fontWeight = if (isActivateFocused) FontWeight.Bold else FontWeight.SemiBold,
            )
          }
        }
      }
    }
  }
}

@Composable
private fun TvPlayerRoute(
  session: TvDeviceSession,
  onResetPairing: () -> Unit,
) {
  val activity = LocalContext.current as? ComponentActivity
  val repository = remember { TvManifestRepository() }
  var state by remember(session.screenId, session.apiBaseUrl) {
    mutableStateOf<ManifestUiState>(ManifestUiState.Loading)
  }
  var appInForeground by remember(activity) {
    mutableStateOf(
      activity?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.STARTED) == true,
    )
  }

  DisposableEffect(activity) {
    if (activity == null) {
      onDispose {}
    } else {
      val observer =
        LifecycleEventObserver { _, event ->
          when (event) {
            Lifecycle.Event.ON_START, Lifecycle.Event.ON_RESUME -> appInForeground = true
            Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> appInForeground = false
            else -> Unit
          }
        }

      activity.lifecycle.addObserver(observer)
      onDispose {
        activity.lifecycle.removeObserver(observer)
      }
    }
  }

  LaunchedEffect(session.screenId, session.apiBaseUrl, appInForeground) {
    if (!appInForeground) {
      return@LaunchedEffect
    }

    var deviceRegistered = false

    while (true) {
      val result =
        runCatching {
          if (deviceRegistered) {
            repository.loadManifest(session)
          } else {
            repository.syncDeviceAndLoadManifest(session)
          }
        }

      result
        .onSuccess { manifest ->
          deviceRegistered = true

          val current = state
          state =
            if (current is ManifestUiState.Ready &&
              current.manifest.playlistVersion == manifest.playlistVersion
            ) {
              if (current.manifest == manifest) current else ManifestUiState.Ready(manifest)
            } else {
              ManifestUiState.Ready(manifest)
            }
        }.onFailure { error ->
          if (shouldStopPlaybackForError(error) || state !is ManifestUiState.Ready) {
            state = ManifestUiState.Error(error.message ?: "Falha ao carregar manifesto")
          }
        }

      delay(MANIFEST_REFRESH_INTERVAL_MS)
    }
  }

  when (val current = state) {
    ManifestUiState.Loading -> LoadingState()
    is ManifestUiState.Error -> ErrorState(
      message = current.message,
      onResetPairing = onResetPairing,
    )
    is ManifestUiState.Ready -> PlayerScreen(manifest = current.manifest)
  }
}

@Composable
private fun LoadingState() {
  Box(
    modifier = Modifier.fillMaxSize().background(Color.Black),
    contentAlignment = Alignment.Center,
  ) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
      CircularProgressIndicator()
      Spacer(modifier = Modifier.height(16.dp))
      Text("Carregando manifesto da TV...", color = Color.White)
    }
  }
}

@Composable
private fun ErrorState(
  message: String,
  onResetPairing: () -> Unit,
) {
  Box(
    modifier = Modifier.fillMaxSize().background(Color.Black),
    contentAlignment = Alignment.Center,
  ) {
    Card(
      colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
      modifier = Modifier.width(680.dp),
    ) {
      Column(
        modifier = Modifier.padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        Text("Falha no player", color = Color.White, fontSize = 28.sp)
        Text(message, color = Color(0xFFCBD5E1))
        Button(onClick = onResetPairing) {
          Text("Voltar para ativacao")
        }
      }
    }
  }
}

@Composable
private fun PlayerScreen(manifest: TvScreenManifest) {
  Box(
    modifier = Modifier.fillMaxSize().background(Color.Black),
  ) {
    TvViewport(manifest = manifest)
  }
}

@Composable
private fun TvViewport(manifest: TvScreenManifest) {
  val layout =
    remember(manifest.orientation, manifest.displayMode) {
      resolveTvContentLayout(manifest)
    }

  if (!layout.usePortraitCanvas || layout.rotationDegrees == 0f) {
    TvLayoutCanvas(
      manifest = manifest,
      shouldCropMedia = layout.shouldCropMedia,
      modifier = Modifier.fillMaxSize(),
    )
    return
  }

  Layout(
    content = {
      TvLayoutCanvas(
        manifest = manifest,
        shouldCropMedia = false,
        modifier = Modifier.fillMaxSize(),
      )
    },
    modifier = Modifier.fillMaxSize().background(Color.Black),
  ) { measurables, constraints ->
    val viewportW = constraints.maxWidth
    val viewportH = constraints.maxHeight
    // Canvas retrato real (ex. 1080x1920). Nao usar BoxWithConstraints aqui:
    // .height(viewportW) seria limitado a maxHeight (1080) e viraria quadrado.
    val portraitW = viewportH
    val portraitH = viewportW

    val placeable =
      measurables[0].measure(
        Constraints.fixed(portraitW, portraitH),
      )

    layout(viewportW, viewportH) {
      placeable.placeWithLayer(
        x = (viewportW - portraitW) / 2,
        y = (viewportH - portraitH) / 2,
        layerBlock = {
          rotationZ = layout.rotationDegrees
          transformOrigin = TransformOrigin(0.5f, 0.5f)
          clip = false
        },
      )
    }
  }
}

@Composable
private fun TvLayoutCanvas(
  manifest: TvScreenManifest,
  shouldCropMedia: Boolean,
  modifier: Modifier = Modifier,
) {
  BoxWithConstraints(modifier = modifier) {
    val canvasWidth = manifest.canvasWidth.toFloat()
    val canvasHeight = manifest.canvasHeight.toFloat()

    manifest.regions.sortedBy { it.zIndex }.forEach { region ->
      val left = maxWidth * (region.x / canvasWidth)
      val top = maxHeight * (region.y / canvasHeight)
      val width = maxWidth * (region.width / canvasWidth)
      val height = maxHeight * (region.height / canvasHeight)

      Box(
        modifier =
          Modifier
            .absoluteOffset(x = left, y = top)
            .width(width)
            .height(height)
            .clip(RectangleShape)
            .background(Color.Black),
      ) {
        RegionLayer(
          region = region,
          shouldCropMedia = shouldCropMedia,
        )
      }
    }
  }
}

@Composable
private fun RegionLayer(
  region: TvLayoutRegion,
  shouldCropMedia: Boolean,
) {
  val items = remember(region.items) { region.items.ifEmpty { listOf() } }
  var currentIndex by remember(region.id) { mutableIntStateOf(0) }
  val currentItem = items.getOrNull(currentIndex)

  LaunchedEffect(region.id, items) {
    if (items.size <= 1) return@LaunchedEffect

    currentIndex = 0
    while (true) {
      val item = items[currentIndex]
      delay(item.durationSeconds * 1000L)
      currentIndex = (currentIndex + 1) % items.size
    }
  }

  if (currentItem == null) {
    Box(
      modifier = Modifier.fillMaxSize().padding(12.dp),
      contentAlignment = Alignment.Center,
    ) {
      Text("Sem itens na regiao", color = Color.White.copy(alpha = 0.65f))
    }
    return
  }

  when {
    region.type == TvRegionType.BANNER || currentItem.type == TvRegionItemType.BANNER -> {
      BannerRegionView(region = region, item = currentItem)
    }

    currentItem.type == TvRegionItemType.IMAGE && !currentItem.source.isNullOrBlank() -> {
      ImageRegionView(
        item = currentItem,
        shouldCropMedia = shouldCropMedia,
      )
    }

    currentItem.type == TvRegionItemType.VIDEO && !currentItem.source.isNullOrBlank() -> {
      VideoRegionView(
        item = currentItem,
        shouldCropMedia = shouldCropMedia,
      )
    }

    else -> {
      MediaPlaceholderView(item = currentItem)
    }
  }
}

@Composable
private fun BannerRegionView(
  region: TvLayoutRegion,
  item: TvRegionItem,
) {
  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .background(parseColorOrFallback(item.backgroundHex))
        .padding(horizontal = 24.dp, vertical = 18.dp),
    verticalArrangement = Arrangement.Center,
  ) {
    Text(
      text = item.title.ifBlank { region.name },
      color = parseColorOrFallback(item.textHex),
      fontWeight = FontWeight.SemiBold,
      fontSize = 20.sp,
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = item.bannerText.orEmpty(),
      color = parseColorOrFallback(item.textHex),
      fontSize = 18.sp,
      maxLines = 3,
      overflow = TextOverflow.Ellipsis,
    )
  }
}

@Composable
private fun MediaPlaceholderView(item: TvRegionItem) {
  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .background(Color(0xFF0F172A))
        .padding(18.dp),
    verticalArrangement = Arrangement.Center,
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Text(item.title, color = Color.White, fontWeight = FontWeight.SemiBold)
    Spacer(modifier = Modifier.height(8.dp))
    Text(
      text = when (item.type) {
        TvRegionItemType.IMAGE -> "Placeholder de imagem"
        TvRegionItemType.BANNER -> "Placeholder de banner"
        TvRegionItemType.VIDEO -> "Video sem source"
      },
      color = Color(0xFF94A3B8),
    )
    if (!item.source.isNullOrBlank()) {
      Spacer(modifier = Modifier.height(8.dp))
      Text(
        text = item.source,
        color = Color(0xFF64748B),
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )
    }
  }
}

@Composable
private fun ImageRegionView(
  item: TvRegionItem,
  shouldCropMedia: Boolean,
) {
  val imageResult by produceState(
    initialValue = ImageLoadResult(bitmap = null),
    key1 = item.id,
    key2 = item.source,
  ) {
    value =
      withContext(Dispatchers.IO) {
        loadImageBitmap(item.source)
      }
  }

  if (imageResult.bitmap == null) {
    MediaPlaceholderView(
      item =
        item.copy(
          title =
            imageResult.error?.let { "${item.title} ($it)" }
              ?: "${item.title} (carregando imagem)",
        ),
    )
    return
  }

  Image(
    bitmap = requireNotNull(imageResult.bitmap),
    contentDescription = item.title,
    modifier = Modifier.fillMaxSize(),
    contentScale = if (shouldCropMedia) ContentScale.Crop else ContentScale.Fit,
  )
}

@Composable
private fun VideoRegionView(
  item: TvRegionItem,
  shouldCropMedia: Boolean,
) {
  val context = LocalContext.current
  var playbackError by remember(item.id, item.source) { mutableStateOf<String?>(null) }
  val mediaUri by produceState<Uri?>(initialValue = null, key1 = item.id, key2 = item.source) {
    value =
      withContext(Dispatchers.IO) {
        resolvePlayableVideoUri(context, item)
      }
  }

  if (mediaUri == null) {
    MediaPlaceholderView(
      item = item.copy(title = "${item.title} (preparando video)"),
    )
    return
  }

  if (playbackError != null) {
    MediaPlaceholderView(
      item = item.copy(title = "${item.title} ($playbackError)"),
    )
    return
  }

  val exoPlayer =
    remember(item.id, mediaUri, shouldCropMedia) {
      ExoPlayer.Builder(context).build().apply {
        repeatMode = Player.REPEAT_MODE_ALL
        playWhenReady = true
        videoScalingMode =
          if (shouldCropMedia) {
            C.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING
          } else {
            C.VIDEO_SCALING_MODE_SCALE_TO_FIT
          }
        setMediaItem(MediaItem.fromUri(requireNotNull(mediaUri)))
        prepare()
      }
    }

  DisposableEffect(exoPlayer) {
    val listener =
      object : Player.Listener {
        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
          playbackError = error.message ?: "falha no video"
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
          if (playbackState == Player.STATE_READY) {
            playbackError = null
          }
        }
      }

    exoPlayer.addListener(listener)

    onDispose {
      exoPlayer.removeListener(listener)
      exoPlayer.release()
    }
  }

  AndroidView(
    factory = { viewContext ->
      TextureView(viewContext).apply {
        isOpaque = true
      }
    },
    modifier = Modifier.fillMaxSize(),
    update = { textureView ->
      exoPlayer.videoScalingMode =
        if (shouldCropMedia) {
          C.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING
        } else {
          C.VIDEO_SCALING_MODE_SCALE_TO_FIT
        }
      exoPlayer.setVideoTextureView(textureView)
    },
    onRelease = { textureView ->
      exoPlayer.clearVideoTextureView(textureView)
    },
  )
}

private fun resolvePlayableVideoUri(
  context: Context,
  item: TvRegionItem,
): Uri? {
  val source = item.source ?: return null
  if (!source.startsWith("data:")) return Uri.parse(source)

  val payload = parseDataUri(source) ?: return null
  val extension = mimeTypeToExtension(payload.mimeType, "mp4")
  val dir = File(context.cacheDir, "up-indoor-media").apply { mkdirs() }
  val file = File(dir, "${item.id}.$extension")
  file.writeBytes(payload.bytes)
  return Uri.fromFile(file)
}

private fun loadImageBitmap(source: String?): ImageLoadResult {
  if (source.isNullOrBlank()) {
    return ImageLoadResult(bitmap = null, error = "imagem sem source")
  }

  return try {
    val bytes =
      if (source.startsWith("data:")) {
        parseDataUri(source)?.bytes
      } else {
        val connection = (URL(source).openConnection() as HttpURLConnection).apply {
          connectTimeout = 30_000
          readTimeout = 30_000
          instanceFollowRedirects = true
          setRequestProperty("User-Agent", "UpIndoorTV/1.0")
        }

        connection.inputStream.use { input -> input.readBytes() }
      }

    val bitmap =
      bytes?.let {
        BitmapFactory.decodeByteArray(it, 0, it.size)
      }

    if (bitmap == null) {
      ImageLoadResult(bitmap = null, error = "falha ao abrir imagem")
    } else {
      ImageLoadResult(bitmap = bitmap.asImageBitmap())
    }
  } catch (_: Exception) {
    ImageLoadResult(bitmap = null, error = "falha ao carregar imagem")
  }
}

private fun parseDataUri(source: String): DataUriPayload? {
  if (!source.startsWith("data:")) return null

  val commaIndex = source.indexOf(',')
  if (commaIndex == -1) return null

  val meta = source.substring(5, commaIndex)
  val data = source.substring(commaIndex + 1)
  val mimeType = meta.substringBefore(';').ifBlank { "application/octet-stream" }
  val isBase64 = meta.contains(";base64")

  val bytes =
    if (isBase64) {
      Base64.decode(data, Base64.DEFAULT)
    } else {
      URLDecoder.decode(data, "UTF-8").toByteArray()
    }

  return DataUriPayload(mimeType = mimeType, bytes = bytes)
}

private fun mimeTypeToExtension(
  mimeType: String,
  fallback: String,
): String {
  return when (mimeType.lowercase()) {
    "image/png" -> "png"
    "image/jpeg" -> "jpg"
    "image/jpg" -> "jpg"
    "image/webp" -> "webp"
    "image/gif" -> "gif"
    "video/mp4" -> "mp4"
    "video/webm" -> "webm"
    "video/quicktime" -> "mov"
    else -> fallback
  }
}

private fun parseColorOrFallback(value: String?): Color {
  return try {
    Color(parseColor(value ?: "#111827"))
  } catch (_: IllegalArgumentException) {
    Color(0xFF111827)
  }
}
