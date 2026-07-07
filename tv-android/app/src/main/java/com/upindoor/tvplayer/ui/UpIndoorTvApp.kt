package com.upindoor.tvplayer.ui

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Color.parseColor
import android.net.Uri
import android.util.Base64
import android.view.LayoutInflater
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
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
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.upindoor.tvplayer.R
import com.upindoor.tvplayer.data.BackendConfig
import com.upindoor.tvplayer.data.DeviceSessionStore
import com.upindoor.tvplayer.data.TvBackendException
import com.upindoor.tvplayer.data.TvManifestRepository
import com.upindoor.tvplayer.data.PlaybackAnalytics
import com.upindoor.tvplayer.data.TvPlaybackCache
import com.upindoor.tvplayer.model.TvDeviceSession
import com.upindoor.tvplayer.model.TvLayoutRegion
import com.upindoor.tvplayer.model.TvRegionItem
import com.upindoor.tvplayer.model.TvRegionItemType
import com.upindoor.tvplayer.model.TvRegionType
import com.upindoor.tvplayer.model.TvScreenManifest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
      PairingScreen(
        session = session,
        onPaired = { screenId ->
          sessionStore.save(screenId)
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

  data class Ready(
    val manifest: TvScreenManifest,
    val isOffline: Boolean = false,
    val lastSyncedAt: Long? = null,
  ) : ManifestUiState

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
private fun PairingScreen(
  session: TvDeviceSession,
  onPaired: (screenId: String) -> Unit,
) {
  val repository = remember { TvManifestRepository() }
  var qrPayload by remember { mutableStateOf<String?>(null) }
  var statusMessage by remember { mutableStateOf("Preparando pareamento...") }
  var errorMessage by remember { mutableStateOf<String?>(null) }

  LaunchedEffect(session.deviceCode) {
    while (true) {
      try {
        val bootstrap = repository.bootstrapDevice(session)
        if (bootstrap.paired && !bootstrap.screenId.isNullOrBlank()) {
          onPaired(bootstrap.screenId)
          return@LaunchedEffect
        }

        qrPayload = bootstrap.qrPayload
        statusMessage = "Escaneie este QR no dashboard"

        while (true) {
          delay(3_000)
          val pairingStatus = repository.getPairingStatus(session)
          if (pairingStatus.paired && !pairingStatus.screenId.isNullOrBlank()) {
            onPaired(pairingStatus.screenId)
            return@LaunchedEffect
          }

          statusMessage =
            when (pairingStatus.status) {
              "pending" -> "Aguardando pareamento no dashboard..."
              else -> "Status: ${pairingStatus.status}"
            }
        }
      } catch (error: Throwable) {
        errorMessage = error.message ?: "Falha ao conectar com o servidor"
        delay(5_000)
        errorMessage = null
      }
    }
  }

  val qrBitmap =
    remember(qrPayload) {
      qrPayload?.let { QrCodeUtils.generateBitmap(it, 512) }
    }

  Box(
    modifier =
      Modifier
        .fillMaxSize()
        .background(Color(0xFF020617)),
    contentAlignment = Alignment.Center,
  ) {
    Card(
      colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
      shape = RoundedCornerShape(24.dp),
      modifier =
        Modifier
          .fillMaxWidth(0.92f)
          .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
      Column(
        modifier =
          Modifier
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
      ) {
        Image(
          painter = painterResource(R.drawable.up_indoor_mascot),
          contentDescription = "Up Indoor",
          modifier = Modifier.height(72.dp),
          contentScale = ContentScale.Fit,
        )
        Text(
          text = "Pareamento da TV",
          style = MaterialTheme.typography.headlineSmall,
          color = Color.White,
        )
        Text(
          text = statusMessage,
          color = Color(0xFFCBD5E1),
          lineHeight = 20.sp,
        )

        if (qrBitmap != null) {
          Image(
            bitmap = qrBitmap.asImageBitmap(),
            contentDescription = "QR de pareamento",
            modifier =
              Modifier
                .size(280.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .padding(12.dp),
          )
        } else {
          CircularProgressIndicator(color = Color(0xFF22D3EE))
        }

        Card(
          colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
          modifier = Modifier.fillMaxWidth(),
        ) {
          Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
          ) {
            Text(
              text = "Codigo do dispositivo",
              color = Color(0xFF94A3B8),
              fontSize = 13.sp,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
              text = session.deviceCode,
              color = Color.White,
              fontSize = 24.sp,
              fontWeight = FontWeight.Bold,
            )
          }
        }

        errorMessage?.let { message ->
          Text(
            text = message,
            color = Color(0xFFF87171),
            fontSize = 14.sp,
          )
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
  val context = LocalContext.current
  val activity = context as? ComponentActivity
  val playbackCache = remember(context) { TvPlaybackCache(context) }
  val playbackAnalytics = remember { PlaybackAnalytics() }
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
          playbackCache.loadManifest(
            session = session,
            registerDevice = !deviceRegistered,
          )
        }

      result
        .onSuccess { loadResult ->
          deviceRegistered = true

          val current = state
          state =
            if (current is ManifestUiState.Ready &&
              current.manifest.playlistVersion == loadResult.manifest.playlistVersion &&
              !loadResult.isOffline
            ) {
              current.copy(
                manifest = loadResult.manifest,
                isOffline = false,
                lastSyncedAt = loadResult.lastSyncedAt,
              )
            } else {
              ManifestUiState.Ready(
                manifest = loadResult.manifest,
                isOffline = loadResult.isOffline,
                lastSyncedAt = loadResult.lastSyncedAt,
              )
            }
        }.onFailure { error ->
          if (shouldStopPlaybackForError(error)) {
            state = ManifestUiState.Error(error.message ?: "Falha ao carregar manifesto")
          } else {
            val fallback = playbackCache.loadCachedOnly(session)
            if (fallback != null) {
              state =
                ManifestUiState.Ready(
                  manifest = fallback.manifest,
                  isOffline = true,
                  lastSyncedAt = fallback.lastSyncedAt,
                )
            } else if (state !is ManifestUiState.Ready) {
              state = ManifestUiState.Error(error.message ?: "Falha ao carregar manifesto")
            }
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
    is ManifestUiState.Ready ->
      if (appInForeground) {
        PlayerScreen(
          session = session,
          manifest = current.manifest,
          playbackCache = playbackCache,
          playbackAnalytics = playbackAnalytics,
          isOffline = current.isOffline,
          lastSyncedAt = current.lastSyncedAt,
        )
      } else {
        Box(
          modifier = Modifier.fillMaxSize().background(Color.Black),
        )
      }
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
private fun PlayerScreen(
  session: TvDeviceSession,
  manifest: TvScreenManifest,
  playbackCache: TvPlaybackCache,
  playbackAnalytics: PlaybackAnalytics,
  isOffline: Boolean,
  lastSyncedAt: Long?,
) {
  Box(
    modifier = Modifier.fillMaxSize().background(Color.Black),
  ) {
    TvViewport(
      session = session,
      manifest = manifest,
      playbackCache = playbackCache,
      playbackAnalytics = playbackAnalytics,
      isOffline = isOffline,
      lastSyncedAt = lastSyncedAt,
    )
  }
}

@Composable
private fun OfflineBadge(lastSyncedAt: Long?) {
  val label =
    remember(lastSyncedAt) {
      val time =
        lastSyncedAt?.let { syncedAt ->
          SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(syncedAt))
        }
      if (time != null) {
        "Offline — ultima sync $time"
      } else {
        "Offline — usando cache local"
      }
    }

  Box(
    modifier =
      Modifier
        .fillMaxSize()
        .padding(20.dp),
    contentAlignment = Alignment.TopEnd,
  ) {
    Text(
      text = label,
      color = Color(0xFFFDE68A),
      fontSize = 14.sp,
      modifier =
        Modifier
          .background(Color(0xCC111827), RoundedCornerShape(8.dp))
          .padding(horizontal = 12.dp, vertical = 8.dp),
    )
  }
}

@Composable
private fun TvViewport(
  session: TvDeviceSession,
  manifest: TvScreenManifest,
  playbackCache: TvPlaybackCache,
  playbackAnalytics: PlaybackAnalytics,
  isOffline: Boolean = false,
  lastSyncedAt: Long? = null,
) {
  val layout =
    remember(manifest.orientation, manifest.displayMode) {
      resolveTvContentLayout(manifest)
    }

  @Composable
  fun ContentSurface(
    modifier: Modifier = Modifier,
    shouldCropMedia: Boolean = layout.shouldCropMedia,
  ) {
    Box(modifier = modifier.fillMaxSize()) {
      TvLayoutCanvas(
        manifest = manifest,
        session = session,
        playbackCache = playbackCache,
        playbackAnalytics = playbackAnalytics,
        shouldCropMedia = shouldCropMedia,
        modifier = Modifier.fillMaxSize(),
      )
      if (isOffline) {
        OfflineBadge(lastSyncedAt = lastSyncedAt)
      }
    }
  }

  if (!layout.usePortraitCanvas || layout.rotationDegrees == 0f) {
    ContentSurface()
    return
  }

  Layout(
    content = {
      ContentSurface(
        shouldCropMedia = false,
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
  session: TvDeviceSession,
  playbackCache: TvPlaybackCache,
  playbackAnalytics: PlaybackAnalytics,
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
          screenId = manifest.screenId,
          session = session,
          playbackCache = playbackCache,
          playbackAnalytics = playbackAnalytics,
          shouldCropMedia = shouldCropMedia,
        )
      }
    }
  }
}

@Composable
private fun RegionLayer(
  region: TvLayoutRegion,
  screenId: String,
  session: TvDeviceSession,
  playbackCache: TvPlaybackCache,
  playbackAnalytics: PlaybackAnalytics,
  shouldCropMedia: Boolean,
) {
  val items = remember(region.items) { region.items.ifEmpty { listOf() } }
  var currentIndex by remember(region.id) { mutableIntStateOf(0) }
  val currentItem = items.getOrNull(currentIndex)

  LaunchedEffect(region.id, items) {
    if (items.isEmpty()) return@LaunchedEffect

    currentIndex = 0
    playbackAnalytics.logEvent(
      session = session,
      screenId = screenId,
      item = items[0],
      eventType = "started",
    )

    if (items.size <= 1) return@LaunchedEffect

    while (true) {
      val item = items[currentIndex]
      delay(item.durationSeconds * 1000L)
      playbackAnalytics.logEvent(
        session = session,
        screenId = screenId,
        item = item,
        eventType = "completed",
        meta = mapOf("durationSeconds" to item.durationSeconds),
      )
      currentIndex = (currentIndex + 1) % items.size
      playbackAnalytics.logEvent(
        session = session,
        screenId = screenId,
        item = items[currentIndex],
        eventType = "started",
      )
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
        screenId = screenId,
        session = session,
        playbackCache = playbackCache,
        playbackAnalytics = playbackAnalytics,
        shouldCropMedia = shouldCropMedia,
      )
    }

    currentItem.type == TvRegionItemType.VIDEO && !currentItem.source.isNullOrBlank() -> {
      VideoRegionView(
        item = currentItem,
        screenId = screenId,
        session = session,
        playbackCache = playbackCache,
        playbackAnalytics = playbackAnalytics,
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
  screenId: String,
  session: TvDeviceSession,
  playbackCache: TvPlaybackCache,
  playbackAnalytics: PlaybackAnalytics,
  shouldCropMedia: Boolean,
) {
  val imageResult by produceState(
    initialValue = ImageLoadResult(bitmap = null),
    key1 = item.id,
    key2 = item.source,
    key3 = screenId,
  ) {
    value =
      withContext(Dispatchers.IO) {
        loadImageBitmap(
          screenId = screenId,
          itemId = item.id,
          source = item.source,
          playbackCache = playbackCache,
        )
      }
  }

  LaunchedEffect(imageResult.error, item.id) {
    val errorMessage = imageResult.error
    if (errorMessage != null) {
      playbackAnalytics.logEvent(
        session = session,
        screenId = screenId,
        item = item,
        eventType = "failed",
        message = errorMessage,
      )
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
    bitmap = imageResult.bitmap!!,
    contentDescription = item.title,
    modifier = Modifier.fillMaxSize(),
    contentScale = if (shouldCropMedia) ContentScale.Crop else ContentScale.Fit,
  )
}

@Composable
private fun VideoRegionView(
  item: TvRegionItem,
  screenId: String,
  session: TvDeviceSession,
  playbackCache: TvPlaybackCache,
  playbackAnalytics: PlaybackAnalytics,
  shouldCropMedia: Boolean,
) {
  val context = LocalContext.current
  var playbackError by remember(item.id, item.source) { mutableStateOf<String?>(null) }
  var cacheBypassAttempt by remember(item.id, item.source) { mutableIntStateOf(0) }
  val mediaUri by produceState<Uri?>(
    initialValue = null,
    item.id,
    item.source,
    screenId,
    cacheBypassAttempt,
  ) {
    value =
      withContext(Dispatchers.IO) {
        resolvePlayableVideoUri(
          context = context,
          screenId = screenId,
          item = item,
          playbackCache = playbackCache,
          preferRemote = cacheBypassAttempt > 0,
        )
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

  val resolvedUri = requireNotNull(mediaUri)

  val exoPlayer =
    remember(item.id, resolvedUri, shouldCropMedia) {
      TvExoPlayerFactory.create(context).apply {
        repeatMode = Player.REPEAT_MODE_ALL
        playWhenReady = true
        videoScalingMode =
          if (shouldCropMedia) {
            C.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING
          } else {
            C.VIDEO_SCALING_MODE_SCALE_TO_FIT
          }
        setMediaItem(MediaItem.fromUri(resolvedUri))
        prepare()
      }
    }

  val resizeMode =
    if (shouldCropMedia) {
      AspectRatioFrameLayout.RESIZE_MODE_ZOOM
    } else {
      AspectRatioFrameLayout.RESIZE_MODE_FIT
    }

  DisposableEffect(exoPlayer) {
    val listener =
      object : Player.Listener {
        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
          val remoteSource = item.source
          if (
            cacheBypassAttempt == 0 &&
            !remoteSource.isNullOrBlank() &&
            !remoteSource.startsWith("data:")
          ) {
            playbackCache.media().invalidate(screenId, item.id)
            cacheBypassAttempt += 1
            playbackError = null
            return
          }

          playbackError = error.message ?: "falha no video"
          playbackAnalytics.logEvent(
            session = session,
            screenId = screenId,
            item = item,
            eventType = "failed",
            message = playbackError ?: "falha no video",
          )
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
      LayoutInflater.from(viewContext)
        .inflate(R.layout.tv_player_view, null, false) as PlayerView
    },
    modifier = Modifier.fillMaxSize(),
    update = { playerView ->
      playerView.resizeMode = resizeMode
      playerView.player = exoPlayer
    },
    onRelease = { playerView ->
      playerView.player = null
    },
  )
}

private suspend fun resolvePlayableVideoUri(
  context: Context,
  screenId: String,
  item: TvRegionItem,
  playbackCache: TvPlaybackCache,
  preferRemote: Boolean = false,
): Uri? {
  val source = item.source ?: return null

  if (!preferRemote) {
    playbackCache.media().cachedFile(screenId, item.id)?.let { file ->
      if (file.length() > 0L) return Uri.fromFile(file)
    }
  }

  if (!source.startsWith("data:")) {
    runCatching {
      playbackCache.media().ensureCached(screenId, item.id, source)
    }.getOrNull()?.let { file ->
      if (file.length() > 0L) return Uri.fromFile(file)
    }
    return Uri.parse(source)
  }

  val payload = parseDataUri(source) ?: return null
  val extension = mimeTypeToExtension(payload.mimeType, "mp4")
  val dir = File(context.cacheDir, "up-indoor-media").apply { mkdirs() }
  val file = File(dir, "${item.id}.$extension")
  file.writeBytes(payload.bytes)
  return Uri.fromFile(file)
}

private suspend fun loadImageBitmap(
  screenId: String,
  itemId: String,
  source: String?,
  playbackCache: TvPlaybackCache,
): ImageLoadResult {
  if (source.isNullOrBlank()) {
    return ImageLoadResult(bitmap = null, error = "imagem sem source")
  }

  return try {
    playbackCache.media().cachedFile(screenId, itemId)?.let { file ->
      if (file.length() > 0L) {
        val bitmap = BitmapFactory.decodeFile(file.absolutePath)
        if (bitmap != null) {
          return ImageLoadResult(bitmap = bitmap.asImageBitmap())
        }
      }
    }

    val bytes =
      if (source.startsWith("data:")) {
        parseDataUri(source)?.bytes
      } else {
        runCatching {
          playbackCache.media().ensureCached(screenId, itemId, source)
        }.getOrNull()?.let { cached ->
          if (cached.length() > 0L) return@let cached.readBytes()
          null
        } ?: run {
          val connection = (URL(source).openConnection() as HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout = 30_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "UpIndoorTV/1.0")
          }

          connection.inputStream.use { input -> input.readBytes() }
        }
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
