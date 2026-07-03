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

/**
 * Invoca uma Edge Function do Supabase.
 * Ex.: await callEdgeFunction("log-playback", { adId, screenId })
 */
export async function callEdgeFunction<T = unknown>(
  name: string,
  body?: unknown,
): Promise<T> {
  if (!supabase) throw new Error("Supabase não configurado (.env)");
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  return data as T;
}
