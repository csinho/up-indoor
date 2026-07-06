import { createLayoutRegionsFromPreset } from "./layout-presets";
import type {
  Ad,
  AdInput,
  LayoutRegion,
  LayoutRegionItem,
  LayoutTemplate,
  LayoutTemplateInput,
  Screen,
  ScreenInput,
  TvDevice,
} from "./types";
import { isAdRunningNow, sortAdsForPlayback } from "./ad-utils";
import { supabase, supabaseEnabled } from "./supabase";

/**
 * Camada de acesso a dados. Se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 * estiverem definidos no .env, usa Supabase. Caso contrário, usa localStorage.
 *
 * Tabelas Supabase esperadas (crie via SQL Editor):
 *
 *   create table public.screens (
 *     id text primary key,
 *     name text not null,
 *     location text default '',
 *     active boolean default true,
 *     created_at timestamptz default now()
 *   );
 *
 *   create table public.ads (
 *     id uuid primary key default gen_random_uuid(),
 *     title text not null,
 *     advertiser text default '',
 *     screen_ids text[] default '{}',
 *     type text default 'image',
 *     source text default '',
 *     duration int default 10,
 *     active boolean default true,
 *     starts_at timestamptz,
 *     ends_at timestamptz,
 *     created_at timestamptz default now()
 *   );
 */

const STORAGE_KEY = "midia-indoor-db-v1";

interface Db {
  screens: Screen[];
  ads: Ad[];
  layoutTemplates: LayoutTemplate[];
}

function seed(): Db {
  const now = new Date().toISOString();
  const defaultLayoutId = "layout-default-landscape";
  const defaultRegions = createLayoutRegionsFromPreset(
    "main_with_banner",
    "landscape",
  ).map((region, index) => ({
    ...region,
    id: `${defaultLayoutId}-region-${index + 1}`,
    layout_template_id: defaultLayoutId,
    created_at: now,
    updated_at: now,
  }));

  return {
    screens: [
      {
        id: "tv-academia-teste",
        name: "TV Academia Teste",
        location: "Recepção",
        active: true,
        created_at: now,
        orientation: "landscape",
        resolution_width: 1920,
        resolution_height: 1080,
        layout_template_id: defaultLayoutId,
        playlist_version: 1,
        playlist_updated_at: now,
        sound_enabled: false,
        volume: 50,
      },
    ],
    ads: [
      {
        id: crypto.randomUUID(),
        title: "Anuncie aqui",
        advertiser: "Sua empresa",
        screen_ids: ["tv-academia-teste"],
        type: "image",
        source:
          "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600",
        duration: 10,
        active: true,
        starts_at: null,
        ends_at: null,
        created_at: now,
        position: 1,
        preferred_orientation: "any",
      },
    ],
    layoutTemplates: [
      {
        id: defaultLayoutId,
        name: "Layout padrão horizontal",
        description: "Área principal com banner inferior.",
        orientation: "landscape",
        canvas_width: 1920,
        canvas_height: 1080,
        active: true,
        created_at: now,
        updated_at: now,
        regions: defaultRegions,
      },
    ],
  };
}

function normalizeAdPosition(position: number | null | undefined) {
  const parsed = Math.floor(Number(position));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeDb(db: Db): Db {
  const adsByCreation = [...db.ads].sort((left, right) => {
    const createdAtDiff =
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime();

    if (createdAtDiff !== 0) return createdAtDiff;

    return left.id.localeCompare(right.id);
  });

  const ads = adsByCreation.map((ad, index) => ({
    ...ad,
    position: normalizeAdPosition(ad.position) ?? index + 1,
    preferred_orientation: ad.preferred_orientation ?? "any",
  }));

  const screens = db.screens.map((screen) => ({
    ...screen,
    orientation: screen.orientation ?? "landscape",
    resolution_width: screen.resolution_width ?? 1920,
    resolution_height: screen.resolution_height ?? 1080,
    layout_template_id: screen.layout_template_id ?? null,
    playlist_version: screen.playlist_version ?? 1,
    playlist_updated_at: screen.playlist_updated_at ?? screen.created_at,
    sound_enabled: screen.sound_enabled ?? false,
    volume: screen.volume ?? 50,
  }));

  const layoutTemplates = (db.layoutTemplates ?? []).map((template) => ({
    ...template,
    description: template.description ?? "",
    orientation: template.orientation ?? "landscape",
    canvas_width: template.canvas_width ?? 1920,
    canvas_height: template.canvas_height ?? 1080,
    active: template.active ?? true,
    regions: [...(template.regions ?? [])]
      .map((region) => ({
        ...region,
        background: region.background ?? "transparent",
        items: [...(region.items ?? [])]
          .map((item) => ({
            ...item,
            title: item.title ?? "",
            banner_text: item.banner_text ?? null,
            background: item.background ?? "#111827",
            text_color: item.text_color ?? "#ffffff",
            fit_mode: item.fit_mode ?? "cover",
            position: normalizeAdPosition(item.position) ?? 1,
            active: item.active ?? true,
          }))
          .sort((left, right) => left.position - right.position),
      }))
      .sort((left, right) => left.z_index - right.z_index),
  }));

  return { screens, ads, layoutTemplates };
}

function readLocal(): Db {
  if (typeof window === "undefined")
    return { screens: [], ads: [], layoutTemplates: [] };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const s = seed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  }
  try {
    return normalizeDb(JSON.parse(raw) as Db);
  } catch {
    return seed();
  }
}

function writeLocal(db: Db) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDb(db)));
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getNextAdPosition() {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("ads")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return (normalizeAdPosition(data?.position) ?? 0) + 1;
  }

  const db = readLocal();
  const highestPosition = db.ads.reduce((max, ad) => {
    return Math.max(max, normalizeAdPosition(ad.position) ?? 0);
  }, 0);

  return highestPosition + 1;
}

function buildLayoutTemplates(
  templates: LayoutTemplate[],
  regions: LayoutRegion[],
  items: LayoutRegionItem[],
) {
  const itemsByRegion = new Map<string, LayoutRegionItem[]>();
  for (const item of items) {
    const current = itemsByRegion.get(item.layout_region_id) ?? [];
    current.push(item);
    itemsByRegion.set(item.layout_region_id, current);
  }

  const regionsByTemplate = new Map<string, LayoutRegion[]>();
  for (const region of regions) {
    const current = regionsByTemplate.get(region.layout_template_id) ?? [];
    current.push({
      ...region,
      items: (itemsByRegion.get(region.id) ?? []).sort(
        (left, right) => left.position - right.position,
      ),
    });
    regionsByTemplate.set(region.layout_template_id, current);
  }

  return templates.map((template) => ({
    ...template,
    regions: (regionsByTemplate.get(template.id) ?? []).sort(
      (left, right) => left.z_index - right.z_index,
    ),
  }));
}

function materializeLayoutTemplate(input: LayoutTemplateInput, templateId?: string) {
  const now = new Date().toISOString();
  const id = templateId ?? crypto.randomUUID();

  const template: LayoutTemplate = {
    id,
    name: input.name.trim() || "Novo layout",
    description: input.description?.trim() ?? "",
    orientation: input.orientation,
    canvas_width: Math.max(1, Number(input.canvas_width) || 1920),
    canvas_height: Math.max(1, Number(input.canvas_height) || 1080),
    active: input.active ?? true,
    created_at: now,
    updated_at: now,
    regions: [],
  };

  const regions: LayoutRegion[] = input.regions.map((region, index) => {
    const regionId = crypto.randomUUID();
    return {
      id: regionId,
      layout_template_id: id,
      name: region.name.trim() || `Região ${index + 1}`,
      region_type: region.region_type,
      x: Math.max(0, Math.round(Number(region.x) || 0)),
      y: Math.max(0, Math.round(Number(region.y) || 0)),
      width: Math.max(1, Math.round(Number(region.width) || 1)),
      height: Math.max(1, Math.round(Number(region.height) || 1)),
      z_index: Math.max(1, Math.round(Number(region.z_index) || 1)),
      background: region.background?.trim() || "transparent",
      created_at: now,
      updated_at: now,
      items: [],
    };
  });

  const items: LayoutRegionItem[] = regions.flatMap((region, index) => {
    const sourceRegion = input.regions[index];
    return (sourceRegion.items ?? []).map((item, itemIndex) => ({
      id: crypto.randomUUID(),
      layout_region_id: region.id,
      item_type: item.item_type,
      ad_id: item.ad_id ?? null,
      title: item.title?.trim() ?? "",
      banner_text: item.banner_text?.trim() || null,
      background: item.background?.trim() || "#111827",
      text_color: item.text_color?.trim() || "#ffffff",
      fit_mode: item.fit_mode ?? "cover",
      position: Math.max(1, normalizeAdPosition(item.position) ?? itemIndex + 1),
      active: item.active ?? true,
      created_at: now,
      updated_at: now,
    }));
  });

  return {
    template,
    regions,
    items,
    hydrated: buildLayoutTemplates([template], regions, items)[0],
  };
}

// ---------- Screens ----------
export async function listScreens(): Promise<Screen[]> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("screens")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Screen[];
  }
  return readLocal().screens;
}

export async function createScreen(
  input: ScreenInput,
): Promise<Screen> {
  const now = new Date().toISOString();
  const screen: Screen = {
    id: input.id?.trim() || slugify(input.name) || crypto.randomUUID(),
    name: input.name.trim() || "Nova TV",
    location: input.location?.trim() ?? "",
    active: input.active ?? true,
    created_at: now,
    orientation: input.orientation ?? "landscape",
    display_mode: input.display_mode ?? "normal",
    resolution_width: Math.max(1, Number(input.resolution_width) || 1920),
    resolution_height: Math.max(1, Number(input.resolution_height) || 1080),
    layout_template_id: input.layout_template_id ?? null,
    playlist_version: 1,
    playlist_updated_at: now,
    sound_enabled: input.sound_enabled ?? false,
    volume: input.volume ?? 50,
  };
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("screens")
      .insert(screen)
      .select()
      .single();
    if (error) throw error;
    return data as Screen;
  }
  const db = readLocal();
  if (db.screens.some((s) => s.id === screen.id))
    throw new Error("Já existe uma TV com esse ID.");
  db.screens.unshift(screen);
  writeLocal(db);
  return screen;
}

export async function updateScreen(
  id: string,
  patch: Partial<Screen>,
): Promise<Screen> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("screens")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Screen;
  }
  const db = readLocal();
  const s = db.screens.find((x) => x.id === id);
  if (!s) throw new Error("TV não encontrada.");
  Object.assign(s, patch);
  writeLocal(db);
  return s;
}

export async function touchScreenPlaylist(id: string): Promise<void> {
  if (supabaseEnabled && supabase) {
    const { error } = await supabase.rpc("touch_screen_playlist", {
      target_screen_id: id,
    });
    if (error) throw error;
    return;
  }

  const db = readLocal();
  const screen = db.screens.find((entry) => entry.id === id);
  if (!screen) throw new Error("TV não encontrada.");

  screen.playlist_version = (screen.playlist_version ?? 1) + 1;
  screen.playlist_updated_at = new Date().toISOString();
  writeLocal(db);
}

export async function listTvDevices(): Promise<TvDevice[]> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("tv_devices")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as TvDevice[];
  }

  return [];
}

export async function deleteScreen(id: string): Promise<void> {
  if (supabaseEnabled && supabase) {
    await supabase.from("screens").delete().eq("id", id);
    // remove referências nos anúncios
    const { data: ads } = await supabase
      .from("ads")
      .select("id, screen_ids")
      .contains("screen_ids", [id]);
    for (const a of ads ?? []) {
      await supabase
        .from("ads")
        .update({
          screen_ids: (a.screen_ids as string[]).filter((x) => x !== id),
        })
        .eq("id", a.id);
    }
    return;
  }
  const db = readLocal();
  db.screens = db.screens.filter((s) => s.id !== id);
  db.ads.forEach((a) => (a.screen_ids = a.screen_ids.filter((x) => x !== id)));
  writeLocal(db);
}

// ---------- Layout templates ----------
export async function listLayoutTemplates(): Promise<LayoutTemplate[]> {
  if (supabaseEnabled && supabase) {
    const [templatesRes, regionsRes, itemsRes] = await Promise.all([
      supabase.from("layout_templates").select("*").order("created_at", {
        ascending: false,
      }),
      supabase.from("layout_regions").select("*").order("z_index", {
        ascending: true,
      }),
      supabase.from("layout_region_items").select("*").order("position", {
        ascending: true,
      }),
    ]);

    if (templatesRes.error) throw templatesRes.error;
    if (regionsRes.error) throw regionsRes.error;
    if (itemsRes.error) throw itemsRes.error;

    return buildLayoutTemplates(
      (templatesRes.data ?? []) as LayoutTemplate[],
      (regionsRes.data ?? []) as LayoutRegion[],
      (itemsRes.data ?? []) as LayoutRegionItem[],
    );
  }

  return readLocal().layoutTemplates;
}

export async function createLayoutTemplate(
  input: LayoutTemplateInput,
): Promise<LayoutTemplate> {
  const { template, regions, items, hydrated } = materializeLayoutTemplate(input);

  if (supabaseEnabled && supabase) {
    const { error: templateError } = await supabase
      .from("layout_templates")
      .insert({
        id: template.id,
        name: template.name,
        description: template.description,
        orientation: template.orientation,
        canvas_width: template.canvas_width,
        canvas_height: template.canvas_height,
        active: template.active,
      });
    if (templateError) throw templateError;

    if (regions.length > 0) {
      const { error: regionError } = await supabase.from("layout_regions").insert(
        regions.map((region) => ({
          id: region.id,
          layout_template_id: region.layout_template_id,
          name: region.name,
          region_type: region.region_type,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          z_index: region.z_index,
          background: region.background,
        })),
      );
      if (regionError) throw regionError;
    }

    if (items.length > 0) {
      const { error: itemError } = await supabase
        .from("layout_region_items")
        .insert(
          items.map((item) => ({
            id: item.id,
            layout_region_id: item.layout_region_id,
            item_type: item.item_type,
            ad_id: item.ad_id,
            title: item.title,
            banner_text: item.banner_text,
            background: item.background,
            text_color: item.text_color,
            fit_mode: item.fit_mode,
            position: item.position,
            active: item.active,
          })),
        );
      if (itemError) throw itemError;
    }

    return hydrated;
  }

  const db = readLocal();
  db.layoutTemplates.unshift(hydrated);
  writeLocal(db);
  return hydrated;
}

export async function updateLayoutTemplate(
  id: string,
  input: LayoutTemplateInput,
): Promise<LayoutTemplate> {
  const { template, regions, items, hydrated } = materializeLayoutTemplate(input, id);

  if (supabaseEnabled && supabase) {
    const { error: templateError } = await supabase
      .from("layout_templates")
      .update({
        name: template.name,
        description: template.description,
        orientation: template.orientation,
        canvas_width: template.canvas_width,
        canvas_height: template.canvas_height,
        active: template.active,
      })
      .eq("id", id);
    if (templateError) throw templateError;

    const { error: deleteRegionsError } = await supabase
      .from("layout_regions")
      .delete()
      .eq("layout_template_id", id);
    if (deleteRegionsError) throw deleteRegionsError;

    if (regions.length > 0) {
      const { error: regionError } = await supabase.from("layout_regions").insert(
        regions.map((region) => ({
          id: region.id,
          layout_template_id: region.layout_template_id,
          name: region.name,
          region_type: region.region_type,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          z_index: region.z_index,
          background: region.background,
        })),
      );
      if (regionError) throw regionError;
    }

    if (items.length > 0) {
      const { error: itemError } = await supabase
        .from("layout_region_items")
        .insert(
          items.map((item) => ({
            id: item.id,
            layout_region_id: item.layout_region_id,
            item_type: item.item_type,
            ad_id: item.ad_id,
            title: item.title,
            banner_text: item.banner_text,
            background: item.background,
            text_color: item.text_color,
            fit_mode: item.fit_mode,
            position: item.position,
            active: item.active,
          })),
        );
      if (itemError) throw itemError;
    }

    return hydrated;
  }

  const db = readLocal();
  const index = db.layoutTemplates.findIndex((template) => template.id === id);
  if (index === -1) throw new Error("Layout não encontrado.");
  db.layoutTemplates[index] = hydrated;
  writeLocal(db);
  return hydrated;
}

export async function deleteLayoutTemplate(id: string): Promise<void> {
  if (supabaseEnabled && supabase) {
    const { error } = await supabase.from("layout_templates").delete().eq("id", id);
    if (error) throw error;
    return;
  }

  const db = readLocal();
  db.layoutTemplates = db.layoutTemplates.filter((template) => template.id !== id);
  db.screens = db.screens.map((screen) =>
    screen.layout_template_id === id
      ? { ...screen, layout_template_id: null }
      : screen,
  );
  writeLocal(db);
}

// ---------- Ads ----------
export async function listAds(): Promise<Ad[]> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("ads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Ad[];
  }
  return readLocal().ads;
}

export async function createAd(
  input: AdInput,
): Promise<Ad> {
  const position = normalizeAdPosition(input.position) ?? (await getNextAdPosition());
  const ad: Ad = {
    id: crypto.randomUUID(),
    title: input.title.trim() || "Novo anúncio",
    advertiser: input.advertiser?.trim() ?? "",
    screen_ids: input.screen_ids ?? [],
    type: input.type,
    source: input.source,
    duration: Math.max(3, Number(input.duration) || 10),
    active: input.active ?? true,
    starts_at: input.starts_at || null,
    ends_at: input.ends_at || null,
    created_at: new Date().toISOString(),
    position,
    preferred_orientation: input.preferred_orientation ?? "any",
  };
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("ads")
      .insert(ad)
      .select()
      .single();
    if (error) throw error;
    return data as Ad;
  }
  const db = readLocal();
  db.ads.unshift(ad);
  writeLocal(db);
  return ad;
}

export async function updateAd(id: string, patch: Partial<Ad>): Promise<Ad> {
  const normalizedPatch: Partial<Ad> = { ...patch };
  if ("position" in normalizedPatch) {
    normalizedPatch.position =
      normalizeAdPosition(normalizedPatch.position) ?? undefined;
  }

  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("ads")
      .update(normalizedPatch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Ad;
  }
  const db = readLocal();
  const a = db.ads.find((x) => x.id === id);
  if (!a) throw new Error("Anúncio não encontrado.");
  Object.assign(a, normalizedPatch);
  writeLocal(db);
  return a;
}

export async function deleteAd(id: string): Promise<void> {
  if (supabaseEnabled && supabase) {
    await supabase.from("ads").delete().eq("id", id);
    return;
  }
  const db = readLocal();
  db.ads = db.ads.filter((a) => a.id !== id);
  writeLocal(db);
}

export async function getPlayerData(screenId: string) {
  const [screens, ads] = await Promise.all([listScreens(), listAds()]);
  const screen = screens.find((s) => s.id === screenId && s.active);
  if (!screen) return { screen: null, ads: [] as Ad[] };
  const running = ads.filter(
    (ad) =>
      ad.screen_ids.includes(screenId) &&
      isAdRunningNow(ad) &&
      (ad.type === "image" || ad.type === "video"),
  );
  return { screen, ads: sortAdsForPlayback(running) };
}
