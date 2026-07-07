import type {
  Ad,
  LayoutRegion,
  LayoutRegionItem,
  LayoutTemplate,
  Screen,
} from "./types";

export interface PlayerManifestItem {
  id: string;
  type: "image" | "video" | "banner";
  title: string;
  source?: string;
  bannerText?: string | null;
  background?: string;
  textColor?: string;
  duration: number;
}

export interface PlayerManifestRegion {
  id: string;
  name: string;
  type: "media" | "banner";
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  background: string;
  items: PlayerManifestItem[];
}

function mapAdToManifestItem(ad: Ad): PlayerManifestItem {
  return {
    id: ad.id,
    type: ad.type === "video" ? "video" : "image",
    title: ad.title,
    source: ad.source,
    duration: ad.duration,
    background: "#111827",
    textColor: "#FFFFFF",
  };
}

function mapBannerItem(item: LayoutRegionItem): PlayerManifestItem {
  return {
    id: item.id,
    type: "banner",
    title: item.title || "Banner",
    bannerText: item.banner_text,
    background: item.background,
    textColor: item.text_color,
    duration: 15,
  };
}

function buildFallbackRegion(screen: Screen, ads: Ad[]): PlayerManifestRegion {
  const width = screen.resolution_width ?? 1920;
  const height = screen.resolution_height ?? 1080;

  return {
    id: "fallback-main",
    name: "Principal",
    type: "media",
    x: 0,
    y: 0,
    width,
    height,
    zIndex: 1,
    background: "#000000",
    items: ads.map(mapAdToManifestItem),
  };
}

export function buildPlayerManifestRegions(
  screen: Screen,
  layout: LayoutTemplate | null,
  activeAds: Ad[],
): PlayerManifestRegion[] {
  const playlistItems = activeAds.map(mapAdToManifestItem);

  if (!screen.layout_template_id || !layout) {
    return [buildFallbackRegion(screen, activeAds)];
  }

  const regions = [...(layout.regions ?? [])].sort(
    (left, right) => left.z_index - right.z_index,
  );

  if (regions.length === 0) {
    return [buildFallbackRegion(screen, activeAds)];
  }

  const adsById = new Map(activeAds.map((ad) => [ad.id, ad]));

  return regions.map((region) => {
    const regionItems = [...(region.items ?? [])]
      .filter((item) => item.active)
      .sort((left, right) => left.position - right.position);

    const items: PlayerManifestItem[] = [];

    for (const item of regionItems) {
      if (item.item_type === "banner") {
        items.push(mapBannerItem(item));
        continue;
      }

      if (item.item_type === "ad" && item.ad_id) {
        const ad = adsById.get(item.ad_id);
        if (ad) items.push(mapAdToManifestItem(ad));
      }
    }

    if (region.region_type === "media" && items.length === 0) {
      items.push(...playlistItems);
    }

    return {
      id: region.id,
      name: region.name,
      type: region.region_type,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      zIndex: region.z_index,
      background: region.background || "transparent",
      items,
    };
  });
}

export function flattenManifestPlaylist(regions: PlayerManifestRegion[]) {
  const mediaItems = regions.flatMap((region) =>
    region.items.filter((item) => item.type === "image" || item.type === "video"),
  );

  if (mediaItems.length === 0) return [];

  const seen = new Set<string>();
  return mediaItems.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
