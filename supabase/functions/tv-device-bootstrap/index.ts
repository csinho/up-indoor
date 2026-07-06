import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  buildPairingCode,
  buildPairingToken,
  buildQrPairingPayload,
  corsHeaders,
  createAdminClient,
  formatError,
  isPairingTokenExpired,
  jsonResponse,
  pairingTokenExpiresAt,
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const { data: existingDevice, error: existingDeviceError } = await supabase
      .from("tv_devices")
      .select("*")
      .eq("device_code", deviceCode)
      .maybeSingle();

    if (existingDeviceError) {
      throw existingDeviceError;
    }

    const now = new Date().toISOString();

    if (existingDevice?.screen_id && existingDevice.status !== "pending") {
      return jsonResponse({
        deviceCode,
        status: existingDevice.status ?? "paired",
        screenId: existingDevice.screen_id,
        paired: true,
        pairingToken: null,
        pairingTokenExpiresAt: null,
        qrPayload: null,
      });
    }

    const shouldRenewToken =
      !existingDevice?.pairing_token ||
      isPairingTokenExpired(existingDevice?.pairing_token_expires_at);

    const pairingToken = shouldRenewToken
      ? buildPairingToken()
      : existingDevice.pairing_token;
    const tokenExpiresAt = shouldRenewToken
      ? pairingTokenExpiresAt()
      : existingDevice.pairing_token_expires_at;

    const payload = {
      device_code: deviceCode,
      device_name: deviceName || existingDevice?.device_name || "Android TV",
      platform,
      app_version: appVersion,
      os_version: osVersion,
      active: true,
      screen_id: existingDevice?.screen_id ?? null,
      status: existingDevice?.screen_id ? "paired" : "pending",
      pairing_code: existingDevice?.pairing_code ?? buildPairingCode(),
      pairing_code_expires_at: tokenExpiresAt,
      pairing_token: pairingToken,
      pairing_token_expires_at: tokenExpiresAt,
      last_seen_at: now,
      meta: {
        ...(existingDevice?.meta ?? {}),
        source: "tv-device-bootstrap",
      },
    };

    const { data: device, error: writeError } = existingDevice
      ? await supabase
          .from("tv_devices")
          .update(payload)
          .eq("id", existingDevice.id)
          .select(
            "device_code, screen_id, status, pairing_token, pairing_token_expires_at",
          )
          .single()
      : await supabase
          .from("tv_devices")
          .insert(payload)
          .select(
            "device_code, screen_id, status, pairing_token, pairing_token_expires_at",
          )
          .single();

    if (writeError) {
      throw writeError;
    }

    const qrPayload = buildQrPairingPayload({
      deviceCode: device.device_code,
      pairingToken: device.pairing_token,
      apiBaseUrl: supabaseUrl,
    });

    return jsonResponse({
      deviceCode: device.device_code,
      status: device.status,
      screenId: device.screen_id,
      paired: Boolean(device.screen_id),
      pairingToken: device.pairing_token,
      pairingTokenExpiresAt: device.pairing_token_expires_at,
      qrPayload,
    });
  } catch (error) {
    console.error("tv-device-bootstrap failed", error);
    return jsonResponse(
      {
        error: "device_bootstrap_failed",
        message: formatError(error),
      },
      500,
    );
  }
});
