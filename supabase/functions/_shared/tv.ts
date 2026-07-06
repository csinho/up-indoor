import { createClient } from "npm:@supabase/supabase-js@2";

const AD_MEDIA_BUCKET = "ad-media";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isAdRunningNow(ad: {
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}) {
  if (!ad.active) return false;

  const now = new Date();
  if (ad.starts_at && new Date(ad.starts_at) > now) return false;
  if (ad.ends_at && new Date(ad.ends_at) < now) return false;

  return true;
}

export function orientationMatches(
  screenOrientation: string | null,
  preferredOrientation: string | null,
) {
  if (!screenOrientation || !preferredOrientation || preferredOrientation === "any") {
    return true;
  }

  return screenOrientation === preferredOrientation;
}

export function buildPairingCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function isInlineMediaSource(source: string | null | undefined) {
  return Boolean(source?.startsWith("data:"));
}

function mimeTypeToExtension(
  mimeType: string | null | undefined,
  fallback: string,
) {
  switch ((mimeType ?? "").toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    default:
      return fallback;
  }
}

function parseDataUri(source: string) {
  const commaIndex = source.indexOf(",");
  if (commaIndex === -1) return null;

  const meta = source.slice(5, commaIndex);
  const data = source.slice(commaIndex + 1);
  const mimeType = meta.split(";")[0] || "application/octet-stream";
  const isBase64 = meta.includes(";base64");

  const bytes = isBase64
    ? Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(data));

  return { mimeType, bytes };
}

export async function migrateInlineMediaSource(
  supabase: ReturnType<typeof createAdminClient>,
  ad: {
    id: string;
    title: string;
    type: "image" | "video" | "youtube";
    source: string;
  },
) {
  if (!isInlineMediaSource(ad.source)) return ad.source;

  const parsed = parseDataUri(ad.source);
  if (!parsed) return ad.source;

  const extension = mimeTypeToExtension(
    parsed.mimeType,
    ad.type === "video" ? "mp4" : "png",
  );
  const path = `ads/${ad.id}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AD_MEDIA_BUCKET)
    .upload(path, parsed.bytes, {
      upsert: true,
      contentType: parsed.mimeType,
    });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AD_MEDIA_BUCKET).getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("ads")
    .update({ source: publicUrl })
    .eq("id", ad.id);

  if (updateError) {
    throw updateError;
  }

  return publicUrl;
}

export function formatError(error: unknown) {
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
