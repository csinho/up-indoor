const MIN_IMPRESSION_SECONDS = 3;

export type PlaybackEventType =
  | "started"
  | "completed"
  | "skipped"
  | "failed";

function getFunctionsBaseUrl() {
  return (
    (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined) ??
    `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1`
  );
}

function getPublishableKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
}

export async function logPlaybackEvent(input: {
  screenId: string;
  adId: string;
  eventType: PlaybackEventType;
  message?: string;
  meta?: Record<string, unknown>;
}) {
  const publishableKey = getPublishableKey();
  if (!publishableKey) return;

  try {
    await fetch(`${getFunctionsBaseUrl()}/tv-log-playback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      body: JSON.stringify({
        screenId: input.screenId,
        adId: input.adId,
        eventType: input.eventType,
        message: input.message ?? "",
        meta: input.meta ?? {},
      }),
      keepalive: true,
    });
  } catch {
    // Telemetria nao deve interromper o player.
  }
}

export function countsAsImpression(durationSeconds: number) {
  return durationSeconds >= MIN_IMPRESSION_SECONDS;
}
