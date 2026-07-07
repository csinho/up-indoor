# Up Indoor

Base inicial do app nativo para `Android TV / Google TV`.

## O que existe nesta fundação

- launcher para TV com `LEANBACK_LAUNCHER`
- UI nativa com `Jetpack Compose`
- player shell com `Media3 / ExoPlayer`
- fluxo de ativacao e pareamento por QR
- manifesto real via Supabase (`tv-player-manifest`)
- **cache offline**: manifesto JSON + midias em disco para playback sem internet

## Cache offline (Epico 1)

- `ManifestCacheStore`: persiste o JSON do manifesto por `screenId`
- `MediaCacheManager`: baixa imagens/videos para `filesDir/up-indoor/media/`
- `TvPlaybackCache`: orquestra fetch online, prefetch e fallback offline
- Badge **"Offline — ultima sync HH:MM"** quando a rede cai

A TV continua passando campanha apos uma sync bem-sucedida, mesmo sem internet.

## Telemetria (Epico 6)

- `PlaybackAnalytics`: envia eventos `started`, `completed` e `failed` para `tv-log-playback`
- Logs gravados em `tv_playback_logs` no Supabase
- Dashboard exibe impressoes, reproducoes e falhas dos ultimos 7 dias

## Estrutura

- `app/src/main/java/com/upindoor/tvplayer/MainActivity.kt`: entrypoint
- `app/src/main/java/com/upindoor/tvplayer/data`: sessao, manifesto, cache offline
- `app/src/main/java/com/upindoor/tvplayer/model`: contratos do manifesto da TV
- `app/src/main/java/com/upindoor/tvplayer/ui`: telas de ativacao e player

## Proximos passos esperados

1. alertas de TV offline (Epico 5)
2. widgets dinamicos em layouts (Epico 2 — revisar UX de layouts antes)
3. YouTube e links no player (Epico 4)
4. player Windows / Smart TV (Epico 3)

## Como abrir

Abra a pasta `tv-android/` no Android Studio e sincronize o projeto.

## Observacao

Nao consegui validar build localmente nesta maquina porque o ambiente atual nao tem `Java` nem `Gradle` instalados no terminal. Mesmo assim, a estrutura foi criada seguindo a documentacao atual de:

- `Android Gradle Plugin 9.2.0`
- `Kotlin 2.3.21`
- `Compose BOM 2026.06.00`
- `Media3 1.10.1`
