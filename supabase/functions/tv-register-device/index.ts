import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  buildPairingCode,
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
    const body = await request.json();
    const deviceCode = String(body.deviceCode ?? "")
      .trim()
      .toUpperCase();
    const requestedScreenId = String(body.screenId ?? "").trim() || null;
    const deviceName = String(body.deviceName ?? "").trim();
    const platform = String(body.platform ?? "android_tv").trim() || "android_tv";
    const appVersion = String(body.appVersion ?? "").trim();
    const osVersion = String(body.osVersion ?? "").trim();

    if (!deviceCode) {
      return jsonResponse(
        { error: "invalid_device_code", message: "deviceCode is required." },
        400,
      );
    }

    const supabase = createAdminClient();

    const { data: existingDevice, error: existingDeviceError } = await supabase
      .from("tv_devices")
      .select("*")
      .eq("device_code", deviceCode)
      .maybeSingle();

    if (existingDeviceError) {
      throw existingDeviceError;
    }

    let effectiveScreenId = requestedScreenId ?? existingDevice?.screen_id ?? null;

    if (effectiveScreenId) {
      const { data: screen, error: screenError } = await supabase
        .from("screens")
        .select("id, active, playlist_version")
        .eq("id", effectiveScreenId)
        .maybeSingle();

      if (screenError) {
        throw screenError;
      }

      if (!screen || !screen.active) {
        return jsonResponse(
          {
            error: "screen_not_available",
            message: "The provided screenId was not found or is inactive.",
          },
          404,
        );
      }
    }

    const now = new Date().toISOString();
    const payload = {
      device_code: deviceCode,
      device_name: deviceName || existingDevice?.device_name || "Android TV",
      platform,
      app_version: appVersion,
      os_version: osVersion,
      active: true,
      screen_id: effectiveScreenId,
      status: effectiveScreenId ? "paired" : existingDevice?.status ?? "pending",
      pairing_code: existingDevice?.pairing_code ?? buildPairingCode(),
      pairing_code_expires_at: existingDevice?.pairing_code_expires_at ?? null,
      paired_at:
        effectiveScreenId && !existingDevice?.paired_at
          ? now
          : existingDevice?.paired_at ?? null,
      last_seen_at: now,
      meta: {
        ...(existingDevice?.meta ?? {}),
        source: "tv-register-device",
      },
    };

    const { data: device, error: writeError } = existingDevice
      ? await supabase
          .from("tv_devices")
          .update(payload)
          .eq("id", existingDevice.id)
          .select(
            "id, device_code, pairing_code, screen_id, status, app_version, os_version, paired_at, last_seen_at",
          )
          .single()
      : await supabase
          .from("tv_devices")
          .insert(payload)
          .select(
            "id, device_code, pairing_code, screen_id, status, app_version, os_version, paired_at, last_seen_at",
          )
          .single();

    if (writeError) {
      throw writeError;
    }

    return jsonResponse({
      deviceId: device.id,
      deviceCode: device.device_code,
      pairingCode: device.pairing_code,
      screenId: device.screen_id,
      status: device.status,
      appVersion: device.app_version,
      osVersion: device.os_version,
      pairedAt: device.paired_at,
      lastSeenAt: device.last_seen_at,
    });
  } catch (error) {
    console.error("tv-register-device failed", error);
    return jsonResponse(
      {
        error: "register_device_failed",
        message: formatError(error),
      },
      500,
    );
  }
});
