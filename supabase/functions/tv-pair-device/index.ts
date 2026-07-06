import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  corsHeaders,
  createAdminClient,
  createUserClient,
  formatError,
  isPairingTokenExpired,
  jsonResponse,
  parseQrPairingPayload,
} from "../_shared/tv.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const userClient = createUserClient(request);
    if (!userClient) {
      return jsonResponse(
        {
          error: "unauthorized",
          message: "Authentication is required to pair a device.",
        },
        401,
      );
    }

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse(
        {
          error: "unauthorized",
          message: "Invalid or expired session.",
        },
        401,
      );
    }

    const body = await request.json();
    const screenId = String(body.screenId ?? "").trim();
    const qrPayload = String(body.qrPayload ?? "").trim();
    const deviceCode = String(body.deviceCode ?? "")
      .trim()
      .toUpperCase();
    const pairingToken = String(body.pairingToken ?? "").trim();

    let resolvedDeviceCode = deviceCode;
    let resolvedPairingToken = pairingToken;

    if (qrPayload) {
      const parsed = parseQrPairingPayload(qrPayload);
      if (!parsed) {
        return jsonResponse(
          {
            error: "invalid_qr_payload",
            message: "QR payload is invalid.",
          },
          400,
        );
      }
      resolvedDeviceCode = parsed.deviceCode;
      resolvedPairingToken = parsed.pairingToken;
    }

    if (!screenId || !resolvedDeviceCode || !resolvedPairingToken) {
      return jsonResponse(
        {
          error: "invalid_pairing_request",
          message: "screenId and pairing credentials are required.",
        },
        400,
      );
    }

    const supabase = createAdminClient();

    const { data: screen, error: screenError } = await supabase
      .from("screens")
      .select("id, active")
      .eq("id", screenId)
      .maybeSingle();

    if (screenError) {
      throw screenError;
    }

    if (!screen || !screen.active) {
      return jsonResponse(
        {
          error: "screen_not_available",
          message: "Screen was not found or is inactive.",
        },
        404,
      );
    }

    const { data: device, error: deviceError } = await supabase
      .from("tv_devices")
      .select("*")
      .eq("device_code", resolvedDeviceCode)
      .maybeSingle();

    if (deviceError) {
      throw deviceError;
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

    if (device.pairing_token !== resolvedPairingToken) {
      if (device.status === "paired" && device.screen_id === screenId) {
        return jsonResponse({
          deviceId: device.id,
          deviceCode: device.device_code,
          screenId: device.screen_id,
          status: device.status,
          pairedAt: device.paired_at,
          alreadyPaired: true,
        });
      }

      return jsonResponse(
        {
          error: "invalid_pairing_token",
          message: "Pairing token is invalid.",
        },
        409,
      );
    }

    if (isPairingTokenExpired(device.pairing_token_expires_at)) {
      return jsonResponse(
        {
          error: "pairing_token_expired",
          message: "Pairing token expired. Refresh the QR code on the TV.",
        },
        409,
      );
    }

    const now = new Date().toISOString();
    const { data: pairedDevice, error: updateError } = await supabase
      .from("tv_devices")
      .update({
        screen_id: screenId,
        status: "paired",
        paired_at: device.paired_at ?? now,
        pairing_token: null,
        pairing_token_expires_at: null,
        last_seen_at: now,
        meta: {
          ...(device.meta ?? {}),
          pairedBy: authData.user.id,
          pairedAt: now,
          source: "tv-pair-device",
        },
      })
      .eq("id", device.id)
      .select("id, device_code, screen_id, status, paired_at")
      .single();

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      deviceId: pairedDevice.id,
      deviceCode: pairedDevice.device_code,
      screenId: pairedDevice.screen_id,
      status: pairedDevice.status,
      pairedAt: pairedDevice.paired_at,
    });
  } catch (error) {
    console.error("tv-pair-device failed", error);
    return jsonResponse(
      {
        error: "pair_device_failed",
        message: formatError(error),
      },
      500,
    );
  }
});
