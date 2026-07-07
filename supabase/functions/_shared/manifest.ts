type ManifestItem = {
  id: string;
  type: "image" | "video" | "banner";
  title: string;
  source?: string;
  bannerText?: string | null;
  backgroundHex?: string;
  textHex?: string;
  durationSeconds: number;
};

type ManifestRegion = {
  id: string;
  name: string;
  type: "media" | "banner";
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  backgroundHex: string;
  items: ManifestItem[];
};

type LayoutRegionRow = {
  id: string;
  layout_template_id: string;
  name: string;
  region_type: "media" | "banner";
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  background: string;
};

type LayoutRegionItemRow = {
  id: string;
  layout_region_id: string;
  item_type: "ad" | "banner";
  ad_id: string | null;
  title: string;
  banner_text: string | null;
  background: string;
  text_color: string;
  position: number;
  active: boolean;
};

type AdRow = {
  id: string;
  title: string;
  type: "image" | "video" | "youtube";
  source: string;
  duration: number;
};

export function mapAdToManifestItem(ad: AdRow): ManifestItem {
  return {
    id: ad.id,
    type: ad.type === "video" ? "video" : "image",
    title: ad.title,
    source: ad.source,
    durationSeconds: ad.duration,
    backgroundHex: "#111827",
    textHex: "#FFFFFF",
  };
}

function mapBannerItem(item: LayoutRegionItemRow): ManifestItem {
  return {
    id: item.id,
    type: "banner",
    title: item.title || "Banner",
    bannerText: item.banner_text,
    backgroundHex: item.background,
    textHex: item.text_color,
    durationSeconds: 15,
  };
}

function buildFallbackRegion(
  width: number,
  height: number,
  playlistItems: ManifestItem[],
): ManifestRegion {
  return {
    id: "fallback-main",
    name: "Principal",
    type: "media",
    x: 0,
    y: 0,
    width,
    height,
    zIndex: 1,
    backgroundHex: "#000000",
    items: playlistItems,
  };
}

export function buildManifestRegions(input: {
  layoutTemplateId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  regions: LayoutRegionRow[];
  regionItems: LayoutRegionItemRow[];
  activeAds: AdRow[];
}): ManifestRegion[] {
  const playlistItems = input.activeAds.map(mapAdToManifestItem);

  if (!input.layoutTemplateId || input.regions.length === 0) {
    return [
      buildFallbackRegion(
        input.canvasWidth,
        input.canvasHeight,
        playlistItems,
      ),
    ];
  }

  const itemsByRegion = new Map<string, LayoutRegionItemRow[]>();
  for (const item of input.regionItems) {
    const current = itemsByRegion.get(item.layout_region_id) ?? [];
    current.push(item);
    itemsByRegion.set(item.layout_region_id, current);
  }

  const adsById = new Map(input.activeAds.map((ad) => [ad.id, ad]));

  return [...input.regions]
    .sort((left, right) => left.z_index - right.z_index)
    .map((region) => {
      const regionItems = (itemsByRegion.get(region.id) ?? [])
        .filter((item) => item.active)
        .sort((left, right) => left.position - right.position);

      const items: ManifestItem[] = [];

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
        backgroundHex: region.background || "transparent",
        items,
      };
    });
}
