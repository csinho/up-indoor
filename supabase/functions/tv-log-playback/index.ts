import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  corsHeaders,
  createAdminClient,
  formatError,
  jsonResponse,
} from "../_shared/tv.ts";

const PLAYBACK_EVENTS = new Set([
  "started",
  "completed",
  "skipped",
  "failed",
  "downloaded",
  "sync_applied",
]);

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
    const screenId = String(body.screenId ?? "").trim() || null;
    const adId = String(body.adId ?? "").trim() || null;
    const eventType = String(body.eventType ?? "").trim();
    const message = String(body.message ?? "").trim();
    const meta =
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? body.meta
        : {};

    if (!eventType || !PLAYBACK_EVENTS.has(eventType)) {
      return jsonResponse(
        {
          error: "invalid_event_type",
          message: "eventType must be one of started, completed, skipped, failed.",
        },
        400,
      );
    }

    if (!screenId) {
      return jsonResponse(
        { error: "invalid_screen", message: "screenId is required." },
        400,
      );
    }

    const supabase = createAdminClient();

    const { data: screen, error: screenError } = await supabase
      .from("screens")
      .select("id, active")
      .eq("id", screenId)
      .maybeSingle();

    if (screenError) throw screenError;

    if (!screen || !screen.active) {
      return jsonResponse(
        { error: "screen_inactive", message: "Screen was not found or is inactive." },
        404,
      );
    }

    let deviceId: string | null = null;
    let effectiveScreenId = screenId;

    if (deviceCode) {
      const { data: device, error: deviceError } = await supabase
        .from("tv_devices")
        .select("id, screen_id, active")
        .eq("device_code", deviceCode)
        .maybeSingle();

      if (deviceError) throw deviceError;

      if (!device || !device.active) {
        return jsonResponse(
          {
            error: "device_not_registered",
            message: "Device was not found or is inactive.",
          },
          404,
        );
      }

      deviceId = device.id;
      effectiveScreenId = screenId ?? device.screen_id ?? screenId;
    }

    if (adId) {
      const { data: ad, error: adError } = await supabase
        .from("ads")
        .select("id")
        .eq("id", adId)
        .maybeSingle();

      if (adError) throw adError;
      if (!ad) {
        return jsonResponse(
          { error: "invalid_ad", message: "adId was not found." },
          400,
        );
      }
    }

    const { error: insertError } = await supabase.from("tv_playback_logs").insert({
      device_id: deviceId,
      screen_id: effectiveScreenId,
      ad_id: adId,
      event_type: eventType,
      message,
      meta: {
        ...meta,
        source: deviceCode ? "android_tv" : "web_player",
      },
    });

    if (insertError) throw insertError;

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("tv-log-playback failed", error);
    return jsonResponse(
      {
        error: "playback_log_failed",
        message: formatError(error),
      },
      500,
    );
  }
});
