import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlayerData } from "@/lib/data";
import type { Ad } from "@/lib/types";
import { extractYouTubeId } from "./index";

export const Route = createFileRoute("/player/$screenId")({
  component: PlayerPage,
});

function PlayerPage() {
  const { screenId } = Route.useParams();
  const q = useQuery({
    queryKey: ["player", screenId],
    queryFn: () => getPlayerData(screenId),
    refetchInterval: 30_000,
  });

  const [index, setIndex] = useState(0);
  const ads = q.data?.ads ?? [];
  const current = ads[index];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!current) return;
    // video handles its own advance via onEnded; images/youtube use timer
    if (current.type === "image" || current.type === "youtube") {
      timerRef.current = setTimeout(() => {
        setIndex((i) => (i + 1) % Math.max(ads.length, 1));
      }, current.duration * 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, ads.length]);

  // reset index if list shrinks
  useEffect(() => {
    if (index >= ads.length) setIndex(0);
  }, [ads.length, index]);

  if (q.isLoading) {
    return (
      <FullScreen>
        <div className="text-white/70">Carregando player…</div>
      </FullScreen>
    );
  }

  if (!q.data?.screen) {
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
      <MediaFrame
        ad={current}
        onEnded={() => setIndex((i) => (i + 1) % ads.length)}
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

function MediaFrame({ ad, onEnded }: { ad: Ad; onEnded: () => void }) {
  if (ad.type === "youtube") {
    const id = extractYouTubeId(ad.source);
    if (!id) return <ErrorMsg text="Link do YouTube inválido" />;
    return (
      <iframe
        key={ad.id}
        className="h-full w-full"
        src={`https://www.youtube.com/embed/${id}?autoplay=1&controls=0&mute=0&modestbranding=1&rel=0&playsinline=1`}
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    );
  }
  if (ad.type === "video") {
    return (
      <video
        key={ad.id}
        className="h-full w-full object-contain"
        src={ad.source}
        autoPlay
        playsInline
        onEnded={onEnded}
        onError={onEnded}
      />
    );
  }
  return (
    <img
      key={ad.id}
      src={ad.source}
      alt={ad.title}
      className="h-full w-full object-contain"
      onError={onEnded}
    />
  );
}

function ErrorMsg({ text }: { text: string }) {
  return <div className="text-white/70">{text}</div>;
}
