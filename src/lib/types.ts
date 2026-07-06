export type MediaType = "image" | "video" | "youtube";
export type Orientation = "landscape" | "portrait";
export type AdOrientation = Orientation | "any";
export type ScreenDisplayMode =
  | "normal"
  | "rotate_90"
  | "rotate_270"
  | "fill";
export type LayoutRegionType = "media" | "banner";
export type LayoutItemType = "ad" | "banner";
export type LayoutFitMode = "cover" | "contain";
export type LayoutPresetId =
  | "fullscreen"
  | "main_with_banner"
  | "split_vertical"
  | "split_horizontal"
  | "grid_2x2";

export interface Screen {
  id: string;
  name: string;
  location: string;
  active: boolean;
  created_at: string;
  orientation?: Orientation;
  display_mode?: ScreenDisplayMode;
  resolution_width?: number;
  resolution_height?: number;
  layout_template_id?: string | null;
  playlist_version?: number;
  playlist_updated_at?: string;
  sound_enabled?: boolean;
  volume?: number;
  store_id?: string | null;
}

export type BillingStatus = "active" | "overdue" | "suspended";

export interface Category {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  category_id: string | null;
  active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  category_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  active: boolean;
  notes: string;
  billing_status: BillingStatus;
  monthly_amount_cents: number;
  payment_due_day: number;
  last_payment_at: string | null;
  next_payment_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyScreen {
  company_id: string;
  screen_id: string;
  created_at: string;
}

export interface StoreInput
  extends Omit<Store, "id" | "created_at" | "updated_at"> {}

export interface CompanyInput
  extends Omit<Company, "id" | "created_at" | "updated_at"> {}

export interface Ad {
  id: string;
  public_code: string;
  title: string;
  advertiser: string;
  screen_ids: string[];
  company_id?: string | null;
  type: MediaType;
  source: string;
  duration: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  position: number;
  preferred_orientation?: AdOrientation;
}

export interface AdInput
  extends Omit<Ad, "id" | "created_at" | "position" | "public_code"> {
  position?: number;
  public_code?: string;
}

export interface ScreenInput
  extends Omit<
    Screen,
    "id" | "created_at" | "playlist_version" | "playlist_updated_at"
  > {
  id?: string;
}

export interface LayoutRegionItem {
  id: string;
  layout_region_id: string;
  item_type: LayoutItemType;
  ad_id: string | null;
  title: string;
  banner_text: string | null;
  background: string;
  text_color: string;
  fit_mode: LayoutFitMode;
  position: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LayoutRegion {
  id: string;
  layout_template_id: string;
  name: string;
  region_type: LayoutRegionType;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  background: string;
  created_at: string;
  updated_at: string;
  items?: LayoutRegionItem[];
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  orientation: Orientation;
  canvas_width: number;
  canvas_height: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  regions?: LayoutRegion[];
}

export interface LayoutRegionItemInput
  extends Omit<
    LayoutRegionItem,
    "id" | "layout_region_id" | "created_at" | "updated_at"
  > {}

export interface LayoutRegionInput
  extends Omit<
    LayoutRegion,
    "id" | "layout_template_id" | "created_at" | "updated_at" | "items"
  > {
  items?: LayoutRegionItemInput[];
}

export interface LayoutTemplateInput
  extends Omit<LayoutTemplate, "id" | "created_at" | "updated_at" | "regions"> {
  regions: LayoutRegionInput[];
}

export interface TvDevice {
  id: string;
  device_code?: string;
  device_name: string;
  platform: string;
  pairing_code: string | null;
  pairing_code_expires_at: string | null;
  screen_id: string | null;
  status: "pending" | "paired" | "online" | "idle" | "offline" | "error";
  app_version: string;
  os_version: string;
  last_seen_at: string | null;
  last_playlist_version: number | null;
  last_ip: string | null;
  meta: Record<string, unknown>;
  active: boolean;
  paired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TvDeviceHeartbeat {
  id: number;
  device_id: string;
  screen_id: string | null;
  status: "online" | "idle" | "syncing" | "playing" | "error" | "offline";
  playlist_version: number | null;
  current_ad_id: string | null;
  network_state: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface TvPlaybackLog {
  id: string;
  device_id: string;
  screen_id: string | null;
  ad_id: string | null;
  event_type:
    | "started"
    | "completed"
    | "skipped"
    | "failed"
    | "downloaded"
    | "sync_applied";
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
}
