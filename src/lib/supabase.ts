import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && anon);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url!, anon!)
  : null;

export const functionsUrl =
  (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined) ??
  (url ? `${url}/functions/v1` : undefined);

export const adMediaBucket = "ad-media";

export function isInlineMediaSource(source: string | null | undefined) {
  return Boolean(source?.startsWith("data:"));
}

function getExtensionFromMimeType(mimeType: string | undefined, fallback: string) {
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

async function uploadBlobToStorage(blob: Blob, fileName: string) {
  if (!supabase) throw new Error("Supabase não configurado (.env)");

  const ext =
    fileName.split(".").pop() ||
    getExtensionFromMimeType(blob.type, "bin");
  const safeBaseName =
    fileName
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "") || "media";
  const path = `ads/${safeBaseName}-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(adMediaBucket)
    .upload(path, blob, {
      upsert: true,
      contentType: blob.type || undefined,
    });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(adMediaBucket).getPublicUrl(path);

  return publicUrl;
}

export async function uploadAdMediaFile(file: File) {
  return uploadBlobToStorage(file, file.name);
}

export async function uploadAdMediaDataUri(
  dataUri: string,
  fileName: string,
) {
  if (!isInlineMediaSource(dataUri)) return dataUri;
  const response = await fetch(dataUri);
  const blob = await response.blob();
  return uploadBlobToStorage(blob, fileName);
}

/**
 * Invoca uma Edge Function do Supabase.
 * Ex.: await callEdgeFunction("log-playback", { adId, screenId })
 */
export async function callEdgeFunction<T = unknown>(
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!supabase) throw new Error("Supabase não configurado (.env)");
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  return data as T;
}
