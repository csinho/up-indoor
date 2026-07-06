# Up Indoor TV

Base inicial do app nativo para `Android TV / Google TV`.

## O que existe nesta fundação

- launcher para TV com `LEANBACK_LAUNCHER`
- UI nativa com `Jetpack Compose`
- player shell com `Media3 / ExoPlayer`
- fluxo inicial de ativacao da TV
- armazenamento local simples da sessao do dispositivo
- manifesto demo em memoria para simular `layout + regioes + banners`

## Estrutura

- `app/src/main/java/com/upmidia/tvplayer/MainActivity.kt`: entrypoint
- `app/src/main/java/com/upmidia/tvplayer/data`: sessao local e manifesto demo
- `app/src/main/java/com/upmidia/tvplayer/model`: contratos do manifesto da TV
- `app/src/main/java/com/upmidia/tvplayer/ui`: telas de ativacao e player

## Proximos passos esperados

1. trocar o manifesto demo por chamadas reais ao backend
2. implementar pareamento real por QR code / activation code
3. adicionar cache local de midias
4. suportar imagens e YouTube de forma nativa alem de videos Media3
5. telemetria, heartbeat e recuperacao automatica

## Como abrir

Abra a pasta `tv-android/` no Android Studio e sincronize o projeto.

## Observacao

Nao consegui validar build localmente nesta maquina porque o ambiente atual nao tem `Java` nem `Gradle` instalados no terminal. Mesmo assim, a estrutura foi criada seguindo a documentacao atual de:

- `Android Gradle Plugin 9.2.0`
- `Kotlin 2.3.21`
- `Compose BOM 2026.06.00`
- `Media3 1.10.1`
