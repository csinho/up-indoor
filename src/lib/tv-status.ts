import type { Screen, TvDevice } from "@/lib/types";

const TV_ONLINE_WINDOW_MS = 35_000;
const TV_BACKGROUND_WINDOW_MS = 45_000;

export type TvConnectionLabel =
  | "Online"
  | "Offline"
  | "App fechado"
  | "Sem app"
  | "Aguardando pareamento";

export function getPrimaryTvDevice(screenId: string, tvDevices: TvDevice[]) {
  return [...tvDevices]
    .filter((device) => device.screen_id === screenId)
    .sort((left, right) => {
      const rightTime = new Date(right.last_seen_at ?? right.created_at).getTime();
      const leftTime = new Date(left.last_seen_at ?? left.created_at).getTime();
      return rightTime - leftTime;
    })[0];
}

export function getTvConnectionState(device?: TvDevice) {
  if (!device) {
    return {
      label: "Sem app" as TvConnectionLabel,
      detail: "Nenhum dispositivo pareado",
      className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
      isOnline: false,
    };
  }

  if (device.status === "pending") {
    return {
      label: "Aguardando pareamento" as TvConnectionLabel,
      detail: "Escaneie o QR da TV no dashboard",
      className: "border-warning/40 bg-warning/10 text-warning",
      isOnline: false,
    };
  }

  if (device.last_seen_at) {
    const elapsed = Date.now() - new Date(device.last_seen_at).getTime();

    if (device.status === "idle" && elapsed <= TV_BACKGROUND_WINDOW_MS) {
      return {
        label: "App fechado" as TvConnectionLabel,
        detail: `TV saiu do app ${formatRelativeTime(device.last_seen_at)}`,
        className: "border-warning/40 bg-warning/10 text-warning",
        isOnline: false,
      };
    }

    if (elapsed <= TV_ONLINE_WINDOW_MS) {
      return {
        label: "Online" as TvConnectionLabel,
        detail: `App ativa ${formatRelativeTime(device.last_seen_at)}`,
        className: "border-success/40 bg-success/10 text-success",
        isOnline: true,
      };
    }
  }

  return {
    label: "Offline" as TvConnectionLabel,
    detail: device.last_seen_at
      ? `Sem sinal ${formatRelativeTime(device.last_seen_at)}`
      : "Pareada, mas sem sinal do app",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    isOnline: false,
  };
}

export function getConnectionDotClass(label: TvConnectionLabel, screenActive: boolean) {
  if (label === "Online") {
    return "bg-success shadow-[0_0_10px_var(--success)]";
  }
  if (label === "App fechado" || label === "Aguardando pareamento") {
    return "bg-warning shadow-[0_0_10px_var(--warning)]";
  }
  if (label === "Offline") {
    return "bg-destructive shadow-[0_0_10px_var(--destructive)]";
  }
  return screenActive ? "bg-muted-foreground/60" : "bg-muted-foreground/40";
}

export function summarizeTvStatuses(screens: Screen[], tvDevices: TvDevice[]) {
  let online = 0;
  let offline = 0;
  let idle = 0;
  let unpaired = 0;
  let enabled = 0;

  for (const screen of screens) {
    if (screen.active) enabled += 1;
    const state = getTvConnectionState(getPrimaryTvDevice(screen.id, tvDevices));
    switch (state.label) {
      case "Online":
        online += 1;
        break;
      case "Offline":
        offline += 1;
        break;
      case "App fechado":
      case "Aguardando pareamento":
        idle += 1;
        break;
      default:
        unpaired += 1;
        break;
    }
  }

  return {
    total: screens.length,
    online,
    offline,
    idle,
    unpaired,
    enabled,
    disabled: screens.length - enabled,
  };
}

function formatRelativeTime(value: string) {
  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s atrás`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min atrás`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h atrás`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} d atrás`;
}
