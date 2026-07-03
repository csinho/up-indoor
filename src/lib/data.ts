import type { Ad, Screen } from "./types";
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
}

function seed(): Db {
  const now = new Date().toISOString();
  return {
    screens: [
      {
        id: "tv-academia-teste",
        name: "TV Academia Teste",
        location: "Recepção",
        active: true,
        created_at: now,
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
      },
    ],
  };
}

function readLocal(): Db {
  if (typeof window === "undefined") return { screens: [], ads: [] };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const s = seed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  }
  try {
    return JSON.parse(raw) as Db;
  } catch {
    return seed();
  }
}

function writeLocal(db: Db) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
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
  input: Omit<Screen, "id" | "created_at"> & { id?: string },
): Promise<Screen> {
  const screen: Screen = {
    id: input.id?.trim() || slugify(input.name) || crypto.randomUUID(),
    name: input.name.trim() || "Nova TV",
    location: input.location?.trim() ?? "",
    active: input.active ?? true,
    created_at: new Date().toISOString(),
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
  input: Omit<Ad, "id" | "created_at">,
): Promise<Ad> {
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
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("ads")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Ad;
  }
  const db = readLocal();
  const a = db.ads.find((x) => x.id === id);
  if (!a) throw new Error("Anúncio não encontrado.");
  Object.assign(a, patch);
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
  const now = new Date();
  const running = ads.filter((a) => {
    if (!a.active) return false;
    if (!a.screen_ids.includes(screenId)) return false;
    if (a.starts_at && new Date(a.starts_at) > now) return false;
    if (a.ends_at && new Date(a.ends_at) < now) return false;
    return true;
  });
  return { screen, ads: running };
}
