import type { Ad, AdOrientation, Orientation } from "./types";
import { isAdRunningNow, sortAdsForPlayback } from "./ad-utils";

export interface AdCompanyContext {
  category_id: string | null;
  billing_status: "active" | "overdue" | "suspended";
  active: boolean;
}

export interface TargetableAd {
  id: string;
  screen_ids?: string[] | null;
  company_id?: string | null;
  type: string;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  preferred_orientation?: AdOrientation;
  companies?: AdCompanyContext | null;
}

export function orientationMatches(
  screenOrientation: Orientation | string | null | undefined,
  preferredOrientation: AdOrientation | string | null | undefined,
) {
  if (!preferredOrientation || preferredOrientation === "any") return true;
  if (!screenOrientation) return true;
  return screenOrientation === preferredOrientation;
}

export function adMatchesScreen(
  ad: TargetableAd,
  screenId: string,
  storeCategoryId: string | null,
  linkedCompanyIds: Set<string>,
) {
  const screenIds = ad.screen_ids ?? [];
  if (screenIds.length > 0) {
    return screenIds.includes(screenId);
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

export function filterAdsForScreen(
  ads: TargetableAd[],
  screenId: string,
  storeCategoryId: string | null,
  linkedCompanyIds: Set<string>,
  screenOrientation: Orientation,
) {
  return sortAdsForPlayback(
    ads.filter((ad) => {
      if (ad.type !== "image" && ad.type !== "video") return false;
      if (!isAdRunningNow(ad as Ad)) return false;
      if (!adMatchesScreen(ad, screenId, storeCategoryId, linkedCompanyIds)) {
        return false;
      }
      return orientationMatches(screenOrientation, ad.preferred_orientation);
    }) as Ad[],
  );
}
