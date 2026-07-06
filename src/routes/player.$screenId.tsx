import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlayerData } from "@/lib/data";
import type { Ad, ScreenDisplayMode } from "@/lib/types";

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

  const [turn, setTurn] = useState(0);
  const ads = q.data?.ads ?? [];
  const screen = q.data?.screen;
  const playlistSignature = ads.map((ad) => ad.id).join("|");
  const currentIndex = ads.length > 0 ? turn % ads.length : 0;
  const current = ads[currentIndex];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!current) return;

    timerRef.current = setTimeout(() => {
      setTurn((value) => value + 1);
    }, current.duration * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, turn]);

  // Reset the rotation counter when the playlist changes.
  useEffect(() => {
    setTurn(0);
  }, [screenId, playlistSignature]);

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

  if (ads.length === 0) {
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
      <DisplayViewport
        displayMode={screen.display_mode ?? "normal"}
        ad={current}
        isSingleAd={ads.length === 1}
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

function DisplayViewport({
  displayMode,
  ad,
  isSingleAd,
}: {
  displayMode: ScreenDisplayMode;
  ad: Ad;
  isSingleAd: boolean;
}) {
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
          <MediaFrame ad={ad} isSingleAd={isSingleAd} fillScreen={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <MediaFrame
        ad={ad}
        isSingleAd={isSingleAd}
        fillScreen={displayMode === "fill"}
      />
    </div>
  );
}

function MediaFrame({
  ad,
  isSingleAd,
  fillScreen,
}: {
  ad: Ad;
  isSingleAd: boolean;
  fillScreen: boolean;
}) {
  if (ad.type === "video") {
    return (
      <video
        className={`h-full w-full ${fillScreen ? "object-cover" : "object-contain"}`}
        src={ad.source}
        autoPlay
        muted
        loop
        preload="auto"
        playsInline
      />
    );
  }
  return (
    <img
      src={ad.source}
      alt={ad.title}
      className={`h-full w-full ${fillScreen ? "object-cover" : "object-contain"}`}
    />
  );
}
