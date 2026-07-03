export type MediaType = "image" | "video" | "youtube";

export interface Screen {
  id: string;
  name: string;
  location: string;
  active: boolean;
  created_at: string;
}

export interface Ad {
  id: string;
  title: string;
  advertiser: string;
  screen_ids: string[];
  type: MediaType;
  source: string;
  duration: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}
