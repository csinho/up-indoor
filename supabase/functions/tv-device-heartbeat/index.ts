import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  corsHeaders,
  createAdminClient,
  formatError,
  jsonResponse,
} from "../_shared/tv.ts";

type HeartbeatStatus = "online" | "idle" | "syncing" | "playing" | "error" | "offline";

function mapDeviceStatus(status: HeartbeatStatus) {
  switch (status) {
    case "idle":
      return "idle";
    case "error":
      return "error";
    case "offline":
      return "offline";
    case "online":
    case "syncing":
    case "playing":
    default:
      return "online";
  }
}

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
    const status = String(body.status ?? "online").trim() as HeartbeatStatus;
    const networkState = String(body.networkState ?? "online").trim() || "online";
    const screenId = String(body.screenId ?? "").trim() || null;
    const playlistVersion = Number(body.playlistVersion ?? 0) || null;
    const meta =
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? body.meta
        : {};

    if (!deviceCode) {
      return jsonResponse(
        { error: "invalid_device_code", message: "deviceCode is required." },
        400,
      );
    }

    const allowedStatuses = new Set([
      "online",
      "idle",
      "syncing",
      "playing",
      "error",
      "offline",
    ]);

    if (!allowedStatuses.has(status)) {
      return jsonResponse(
        { error: "invalid_status", message: "status is not supported." },
        400,
      );
    }

    const supabase = createAdminClient();
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

    const now = new Date().toISOString();
    const effectiveScreenId = screenId ?? device.screen_id ?? null;
    const deviceStatus = mapDeviceStatus(status);

    const { error: updateError } = await supabase
      .from("tv_devices")
      .update({
        screen_id: effectiveScreenId,
        status: deviceStatus,
        last_seen_at: now,
        last_playlist_version: playlistVersion,
        meta: {
          ...(typeof meta === "object" ? meta : {}),
          source: "tv-device-heartbeat",
        },
      })
      .eq("id", device.id);

    if (updateError) throw updateError;

    const { error: heartbeatError } = await supabase.from("tv_device_heartbeats").insert({
      device_id: device.id,
      screen_id: effectiveScreenId,
      status,
      playlist_version: playlistVersion,
      current_ad_id: null,
      network_state: networkState,
      meta: {
        ...meta,
        source: "tv-device-heartbeat",
      },
    });

    if (heartbeatError) throw heartbeatError;

    const { error: healthSyncError } = await supabase.rpc(
      "sync_tv_health_notifications_if_due",
      { p_min_interval_seconds: 30 },
    );
    if (healthSyncError) {
      console.error("tv-device-heartbeat health sync failed", healthSyncError);
    }

    return jsonResponse({
      ok: true,
      deviceCode,
      status: deviceStatus,
      lastSeenAt: now,
    });
  } catch (error) {
    console.error("tv-device-heartbeat failed", error);
    return jsonResponse(
      {
        error: "heartbeat_failed",
        message: formatError(error),
      },
      500,
    );
  }
});
