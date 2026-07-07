import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { buildManifestRegions } from "../_shared/manifest.ts";
import {
  corsHeaders,
  createAdminClient,
  formatError,
  isAdRunningNow,
  migrateInlineMediaSource,
  jsonResponse,
  orientationMatches,
} from "../_shared/tv.ts";

type ScreenRow = {
  id: string;
  name: string;
  orientation: "landscape" | "portrait";
  display_mode: "normal" | "rotate_90" | "rotate_270" | "fill";
  resolution_width: number;
  resolution_height: number;
  playlist_version: number;
  active: boolean;
};

type AdRow = {
  id: string;
  title: string;
  type: "image" | "video" | "youtube";
  source: string;
  duration: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  position: number;
  preferred_orientation: "landscape" | "portrait" | "any";
  screen_ids: string[];
  company_id: string | null;
  companies?: {
    category_id: string | null;
    billing_status: "active" | "overdue" | "suspended";
    active: boolean;
  } | null;
};

type ScreenWithStoreRow = ScreenRow & {
  location: string | null;
  store_id: string | null;
  stores?: {
    name: string | null;
    category_id: string | null;
  } | null;
};

function adMatchesScreen(
  ad: AdRow,
  screenId: string,
  storeCategoryId: string | null,
  linkedCompanyIds: Set<string>,
) {
  if ((ad.screen_ids ?? []).length > 0) {
    return ad.screen_ids.includes(screenId);
  }

  if (!ad.company_id || !ad.companies) {
    return false;
  }

  const company = ad.companies;
  if (!company.active || company.billing_status === "suspended") {
    return false;
  }

  if (linkedCompanyIds.has(ad.company_id)) {
    return true;
  }

  return Boolean(
    company.category_id &&
      storeCategoryId &&
      company.category_id === storeCategoryId,
  );
}

type LayoutTemplateRow = {
  id: string;
  name: string;
  orientation: "landscape" | "portrait";
  canvas_width: number;
  canvas_height: number;
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
  fit_mode: "cover" | "contain";
  position: number;
  active: boolean;
};

function sortAds(left: AdRow, right: AdRow) {
  const positionDiff = left.position - right.position;
  if (positionDiff !== 0) return positionDiff;
  return left.id.localeCompare(right.id);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const body = await request.json();
    const deviceCode = String(body.deviceCode ?? "")
      .trim()
      .toUpperCase();

    if (!deviceCode) {
      return jsonResponse(
        { error: "invalid_device_code", message: "deviceCode is required." },
        400,
      );
    }

    const supabase = createAdminClient();

    const { data: device, error: deviceError } = await supabase
      .from("tv_devices")
      .select("id, device_code, screen_id, active")
      .eq("device_code", deviceCode)
      .maybeSingle();

    if (deviceError) {
      throw deviceError;
    }

    if (!device || !device.active) {
      return jsonResponse(
        {
          error: "device_not_registered",
          message: "Device was not found or is inactive.",
        },
        404,
      );
    }

    if (!device.screen_id) {
      return jsonResponse(
        {
          error: "device_not_paired",
          message: "Device exists but does not have a screen assigned yet.",
        },
        409,
      );
    }

    const { data: screen, error: screenError } = await supabase
      .from("screens")
      .select(
        "id, name, location, orientation, display_mode, resolution_width, resolution_height, layout_template_id, playlist_version, active, store_id, stores(name, category_id)",
      )
      .eq("id", device.screen_id)
      .single();

    if (screenError) {
      throw screenError;
    }

    const typedScreen = screen as ScreenWithStoreRow;
    if (!typedScreen.active) {
      return jsonResponse(
        {
          error: "screen_inactive",
          message: "The screen assigned to this device is inactive.",
        },
        409,
      );
    }

    const storeCategoryId = typedScreen.stores?.category_id ?? null;

    const { data: companyLinks, error: companyLinksError } = await supabase
      .from("company_screens")
      .select("company_id")
      .eq("screen_id", typedScreen.id);

    if (companyLinksError) {
      throw companyLinksError;
    }

    const linkedCompanyIds = new Set(
      (companyLinks ?? []).map((link) => String(link.company_id)),
    );

    const { data: adsData, error: adsError } = await supabase
      .from("ads")
      .select(
        "id, title, type, source, duration, active, starts_at, ends_at, position, preferred_orientation, screen_ids, company_id, companies(category_id, billing_status, active)",
      );

    if (adsError) {
      throw adsError;
    }

    const filteredAds = ((adsData ?? []) as AdRow[])
      .filter((ad) => adMatchesScreen(ad, typedScreen.id, storeCategoryId, linkedCompanyIds))
      .filter((ad) => isAdRunningNow(ad))
      .filter((ad) => ad.type === "image" || ad.type === "video")
      .filter((ad) =>
        orientationMatches(typedScreen.orientation, ad.preferred_orientation),
      )
      .sort(sortAds);

    const activeAds: AdRow[] = [];
    for (const ad of filteredAds) {
      const source = await migrateInlineMediaSource(supabase, ad);
      activeAds.push({
        ...ad,
        source,
      });
    }

    let layoutRegions: LayoutRegionRow[] = [];
    let layoutRegionItems: LayoutRegionItemRow[] = [];

    if (typedScreen.layout_template_id) {
      const { data: regionsData, error: regionsError } = await supabase
        .from("layout_regions")
        .select(
          "id, layout_template_id, name, region_type, x, y, width, height, z_index, background",
        )
        .eq("layout_template_id", typedScreen.layout_template_id);

      if (regionsError) {
        throw regionsError;
      }

      layoutRegions = (regionsData ?? []) as LayoutRegionRow[];

      if (layoutRegions.length > 0) {
        const regionIds = layoutRegions.map((region) => region.id);
        const { data: itemsData, error: itemsError } = await supabase
          .from("layout_region_items")
          .select(
            "id, layout_region_id, item_type, ad_id, title, banner_text, background, text_color, position, active",
          )
          .in("layout_region_id", regionIds);

        if (itemsError) {
          throw itemsError;
        }

        layoutRegionItems = (itemsData ?? []) as LayoutRegionItemRow[];
      }
    }

    const manifestRegions = buildManifestRegions({
      layoutTemplateId: typedScreen.layout_template_id,
      canvasWidth: typedScreen.resolution_width,
      canvasHeight: typedScreen.resolution_height,
      regions: layoutRegions,
      regionItems: layoutRegionItems,
      activeAds,
    });

    const manifest = {
      screenId: typedScreen.id,
      screenName: typedScreen.name,
      screenLocation: typedScreen.location ?? "",
      storeName: typedScreen.stores?.name ?? "",
      deviceCode: device.device_code,
      orientation: typedScreen.orientation,
      displayMode: typedScreen.display_mode ?? "normal",
      playlistVersion: typedScreen.playlist_version,
      canvasWidth: typedScreen.resolution_width,
      canvasHeight: typedScreen.resolution_height,
      regions: manifestRegions,
    };

    const now = new Date().toISOString();
    const manifestMeta =
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? body.meta
        : {};
    const appStateRaw = String(body.appState ?? manifestMeta.appState ?? "foreground").trim();
    const displayPowerRaw = String(body.displayPower ?? manifestMeta.displayPower ?? "unknown")
      .trim();
    const appState =
      appStateRaw === "foreground" || appStateRaw === "background"
        ? appStateRaw
        : "foreground";
    const displayPower =
      displayPowerRaw === "on" || displayPowerRaw === "off" ? displayPowerRaw : "unknown";

    await supabase
      .from("tv_devices")
      .update({
        status: "online",
        app_state: appState,
        display_power: displayPower,
        last_seen_at: now,
        last_playlist_version: typedScreen.playlist_version,
        meta: {
          ...manifestMeta,
          appState,
          displayPower,
          source: "tv-player-manifest",
        },
      })
      .eq("id", device.id);

    await supabase.from("tv_device_heartbeats").insert({
      device_id: device.id,
      screen_id: typedScreen.id,
      status: manifest.regions.some((region) => region.items.length > 0)
        ? "playing"
        : "online",
      playlist_version: typedScreen.playlist_version,
      current_ad_id:
        manifest.regions.flatMap((region) => region.items).find((item) =>
          item.type === "video" || item.type === "image",
        )?.id ?? null,
      network_state: "online",
      meta: {
        source: "tv-player-manifest",
      },
    });

    const { error: healthSyncError } = await supabase.rpc("process_tv_screen_health", {
      p_screen_id: typedScreen.id,
    });
    if (healthSyncError) {
      console.error("tv-player-manifest health sync failed", healthSyncError);
    }

    return jsonResponse(manifest);
  } catch (error) {
    console.error("tv-player-manifest failed", error);
    return jsonResponse(
      {
        error: "manifest_failed",
        message: formatError(error),
      },
      500,
    );
  }
});
