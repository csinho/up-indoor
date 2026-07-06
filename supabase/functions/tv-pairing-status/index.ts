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
    const body = await request.json();
    const deviceCode = String(body.deviceCode ?? "")
      .trim()
      .toUpperCase();

    if (!deviceCode) {
      return jsonResponse(
        { error: "invalid_device_code", message: "deviceCode is required." },
        400,
      );
    }

    const supabase = createAdminClient();
    const { data: device, error } = await supabase
      .from("tv_devices")
      .select("device_code, screen_id, status, pairing_token_expires_at")
      .eq("device_code", deviceCode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!device) {
      return jsonResponse(
        {
          error: "device_not_registered",
          message: "Device was not bootstrapped yet.",
        },
        404,
      );
    }

    const paired = Boolean(device.screen_id);

    return jsonResponse({
      deviceCode: device.device_code,
      status: paired ? "paired" : device.status ?? "pending",
      screenId: device.screen_id,
      paired,
      pairingTokenExpiresAt: device.pairing_token_expires_at,
    });
  } catch (error) {
    console.error("tv-pairing-status failed", error);
    return jsonResponse(
      {
        error: "pairing_status_failed",
        message: formatError(error),
      },
      500,
    );
  }
});
