import type { Ad } from "./types";

export type AdPlaybackStatus = "paused" | "scheduled" | "expired" | "live";

export function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );

  return match ? match[1] : null;
}

export function getAdPlaybackStatus(
  ad: Ad,
  now: Date = new Date(),
): AdPlaybackStatus {
  if (!ad.active) return "paused";
  if (ad.starts_at && new Date(ad.starts_at) > now) return "scheduled";
  if (ad.ends_at && new Date(ad.ends_at) < now) return "expired";
  return "live";
}

export function isAdRunningNow(ad: Ad, now: Date = new Date()) {
  return getAdPlaybackStatus(ad, now) === "live";
}

export function getAdPlaybackStatusLabel(status: AdPlaybackStatus) {
  switch (status) {
    case "live":
      return "No ar";
    case "scheduled":
      return "Agendado";
    case "expired":
      return "Encerrado";
    case "paused":
    default:
      return "Pausado";
  }
}

function getAdPosition(ad: Ad) {
  return Number.isFinite(ad.position) && ad.position > 0
    ? ad.position
    : Number.MAX_SAFE_INTEGER;
}

export function sortAdsForPlayback(ads: Ad[]) {
  return [...ads].sort((left, right) => {
    const positionDiff = getAdPosition(left) - getAdPosition(right);

    if (positionDiff !== 0) return positionDiff;

    const createdAtDiff =
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime();

    if (createdAtDiff !== 0) return createdAtDiff;

    return left.id.localeCompare(right.id);
  });
}
