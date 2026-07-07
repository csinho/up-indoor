import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlayerData } from "@/lib/data";
import { logPlaybackEvent } from "@/lib/playback-analytics";
import type { PlayerManifestItem, PlayerManifestRegion } from "@/lib/player-manifest";
import type { ScreenDisplayMode } from "@/lib/types";

export const Route = createFileRoute("/player/$screenId")({
  ssr: false,
  component: PlayerPage,
});

function PlayerPage() {
  const { screenId } = Route.useParams();
  const q = useQuery({
    queryKey: ["player", screenId],
    queryFn: () => getPlayerData(screenId),
    refetchInterval: 30_000,
  });

  const screen = q.data?.screen;
  const regions = q.data?.regions ?? [];
  const ads = q.data?.ads ?? [];
  const hasMedia = regions.some((region) =>
    region.items.some((item) => item.type === "image" || item.type === "video"),
  );

  if (q.isLoading) {
    return (
      <FullScreen>
        <div className="text-white/70">Carregando player…</div>
      </FullScreen>
    );
  }

  if (!screen) {
    return (
      <FullScreen>
        <div className="text-center text-white">
          <div className="text-2xl font-semibold">TV não encontrada</div>
          <p className="mt-2 text-white/60">
            Verifique o ID <code className="font-mono">{screenId}</code> ou se a
            TV está ativa.
          </p>
        </div>
      </FullScreen>
    );
  }

  if (ads.length === 0 || !hasMedia) {
    return (
      <FullScreen>
        <div className="text-center text-white">
          <div className="text-2xl font-semibold">Nenhum anúncio no ar</div>
          <p className="mt-2 text-white/60">
            Vincule campanhas ativas a esta TV no painel.
          </p>
        </div>
      </FullScreen>
    );
  }

  return (
    <FullScreen>
      <LayoutPlayer
        screenId={screenId}
        displayMode={screen.display_mode ?? "normal"}
        canvasWidth={screen.resolution_width ?? 1920}
        canvasHeight={screen.resolution_height ?? 1080}
        regions={regions}
      />
    </FullScreen>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-black">
      {children}
    </div>
  );
}

function LayoutPlayer({
  screenId,
  displayMode,
  canvasWidth,
  canvasHeight,
  regions,
}: {
  screenId: string;
  displayMode: ScreenDisplayMode;
  canvasWidth: number;
  canvasHeight: number;
  regions: PlayerManifestRegion[];
}) {
  const sortedRegions = useMemo(
    () => [...regions].sort((left, right) => left.zIndex - right.zIndex),
    [regions],
  );

  const content = (
    <div
      className="relative h-full w-full overflow-hidden bg-black"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
    >
      {sortedRegions.map((region) => (
        <RegionLayer
          key={region.id}
          screenId={screenId}
          region={region}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      ))}
    </div>
  );

  if (displayMode === "rotate_90" || displayMode === "rotate_270") {
    const rotation = displayMode === "rotate_90" ? "90deg" : "-90deg";
    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        <div
          className="absolute left-1/2 top-1/2 max-w-none"
          style={{
            width: "56.25%",
            height: "177.78%",
            transform: `translate(-50%, -50%) rotate(${rotation})`,
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  return <div className="h-full w-full">{content}</div>;
}

function RegionLayer({
  screenId,
  region,
  canvasWidth,
  canvasHeight,
}: {
  screenId: string;
  region: PlayerManifestRegion;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const playableItems = region.items.filter(
    (item) => item.type === "image" || item.type === "video",
  );
  const [turn, setTurn] = useState(0);
  const current =
    playableItems.length > 0 ? playableItems[turn % playableItems.length] : null;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signature = playableItems.map((item) => item.id).join("|");
  const previousItemRef = useRef<PlayerManifestItem | null>(null);

  useEffect(() => {
    setTurn(0);
  }, [signature]);

  useEffect(() => {
    if (!current) return;

    if (previousItemRef.current?.id !== current.id) {
      void logPlaybackEvent({
        screenId,
        adId: current.id,
        eventType: "started",
        meta: { itemType: current.type, title: current.title },
      });
      previousItemRef.current = current;
    }
  }, [current, screenId]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!current) return;

    if (playableItems.length <= 1) return;

    timerRef.current = setTimeout(() => {
      void logPlaybackEvent({
        screenId,
        adId: current.id,
        eventType: "completed",
        meta: {
          itemType: current.type,
          title: current.title,
          durationSeconds: current.duration,
        },
      });
      setTurn((value) => value + 1);
    }, current.duration * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, playableItems.length, screenId, turn]);

  const style = {
    left: `${(region.x / canvasWidth) * 100}%`,
    top: `${(region.y / canvasHeight) * 100}%`,
    width: `${(region.width / canvasWidth) * 100}%`,
    height: `${(region.height / canvasHeight) * 100}%`,
    zIndex: region.zIndex,
    background: region.background === "transparent" ? undefined : region.background,
  };

  if (region.type === "banner" || region.items.some((item) => item.type === "banner")) {
    const banner = region.items.find((item) => item.type === "banner");
    return (
      <div className="absolute overflow-hidden" style={style}>
        <BannerFrame item={banner ?? region.items[0]} />
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="absolute overflow-hidden" style={style}>
      <MediaFrame
        screenId={screenId}
        item={current}
        fillScreen
      />
    </div>
  );
}

function BannerFrame({ item }: { item: PlayerManifestItem }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center px-4 text-center text-lg font-semibold"
      style={{
        background: item.background ?? "#111827",
        color: item.textColor ?? "#ffffff",
      }}
    >
      {item.bannerText || item.title}
    </div>
  );
}

function MediaFrame({
  screenId,
  item,
  fillScreen,
}: {
  screenId: string;
  item: PlayerManifestItem;
  fillScreen: boolean;
}) {
  if (item.type === "video" && item.source) {
    return (
      <video
        className={`h-full w-full ${fillScreen ? "object-cover" : "object-contain"}`}
        src={item.source}
        autoPlay
        muted
        loop
        preload="auto"
        playsInline
        onError={() => {
          void logPlaybackEvent({
            screenId,
            adId: item.id,
            eventType: "failed",
            message: "falha ao carregar video",
            meta: { itemType: item.type, title: item.title },
          });
        }}
      />
    );
  }

  if (!item.source) {
    return <div className="h-full w-full bg-muted" />;
  }

  return (
    <img
      src={item.source}
      alt={item.title}
      className={`h-full w-full ${fillScreen ? "object-cover" : "object-contain"}`}
      onError={() => {
        void logPlaybackEvent({
          screenId,
          adId: item.id,
          eventType: "failed",
          message: "falha ao carregar imagem",
          meta: { itemType: item.type, title: item.title },
        });
      }}
    />
  );
}
