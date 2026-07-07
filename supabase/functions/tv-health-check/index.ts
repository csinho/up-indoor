import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  corsHeaders,
  createAdminClient,
  formatError,
  jsonResponse,
} from "../_shared/tv.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("sync_tv_health_notifications");

    if (error) throw error;

    return jsonResponse({
      ok: true,
      processedDevices: data ?? 0,
    });
  } catch (error) {
    console.error("tv-health-check failed", error);
    return jsonResponse(
      {
        error: "health_check_failed",
        message: formatError(error),
      },
      500,
    );
  }
});
