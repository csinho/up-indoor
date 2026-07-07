import type { Screen, TvDevice } from "@/lib/types";

/** Janela alinhada ao heartbeat do app Android (10s) + margem. */
const SIGNAL_FRESH_MS = 25_000;

export type TvPowerLabel = "Ligada" | "Desligada" | "Sem sinal" | "Desconhecida";
export type TvAppLabel = "Aberto" | "Fechado" | "Sem resposta" | "Sem app";

export type TvConnectionLabel =
  | "Online"
  | "Offline"
  | "Sem app"
  | "Aguardando pareamento";

function isSignalFresh(device: TvDevice) {
  if (!device.last_seen_at) return false;
  return Date.now() - new Date(device.last_seen_at).getTime() <= SIGNAL_FRESH_MS;
}

function readMetaString(device: TvDevice, key: string) {
  const value = device.meta?.[key];
  return typeof value === "string" ? value : null;
}

function resolveDisplayPower(device: TvDevice) {
  if (device.display_power && device.display_power !== "unknown") {
    return device.display_power;
  }
  return readMetaString(device, "displayPower") as "on" | "off" | "unknown" | null;
}

function resolveAppState(device: TvDevice) {
  if (device.app_state && device.app_state !== "unknown") {
    return device.app_state;
  }
  return readMetaString(device, "appState") as
    | "foreground"
    | "background"
    | "unknown"
    | null;
}

export function getPrimaryTvDevice(screenId: string, tvDevices: TvDevice[]) {
  return [...tvDevices]
    .filter((device) => device.screen_id === screenId)
    .sort((left, right) => {
      const rightTime = new Date(right.last_seen_at ?? right.created_at).getTime();
      const leftTime = new Date(left.last_seen_at ?? left.created_at).getTime();
      return rightTime - leftTime;
    })[0];
}

export function getTvPowerState(device?: TvDevice) {
  if (!device || device.status === "pending") {
    return {
      label: "Desconhecida" as TvPowerLabel,
      detail: "Aguardando pareamento",
      className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
      isOn: false,
    };
  }

  if (!device.screen_id) {
    return {
      label: "Desconhecida" as TvPowerLabel,
      detail: "Sem TV pareada",
      className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
      isOn: false,
    };
  }

  const fresh = isSignalFresh(device);
  const displayPower = resolveDisplayPower(device);

  if (!fresh) {
    return {
      label: "Sem sinal" as TvPowerLabel,
      detail: device.last_seen_at
        ? `Sem resposta ${formatRelativeTime(device.last_seen_at)}`
        : "Nunca respondeu",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      isOn: false,
    };
  }

  if (displayPower === "off") {
    return {
      label: "Desligada" as TvPowerLabel,
      detail: `Tela desligada ${formatRelativeTime(device.last_seen_at!)}`,
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      isOn: false,
    };
  }

  return {
    label: "Ligada" as TvPowerLabel,
    detail: `Sinal ativo ${formatRelativeTime(device.last_seen_at!)}`,
    className: "border-success/40 bg-success/10 text-success",
    isOn: true,
  };
}

export function getTvAppState(device?: TvDevice) {
  if (!device) {
    return {
      label: "Sem app" as TvAppLabel,
      detail: "Nenhum dispositivo pareado",
      className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
      isOpen: false,
    };
  }

  if (device.status === "pending") {
    return {
      label: "Sem app" as TvAppLabel,
      detail: "Aguardando pareamento no Fire Stick",
      className: "border-warning/40 bg-warning/10 text-warning",
      isOpen: false,
    };
  }

  if (!isSignalFresh(device)) {
    return {
      label: "Sem resposta" as TvAppLabel,
      detail: device.last_seen_at
        ? `Último contato ${formatRelativeTime(device.last_seen_at)}`
        : "App nunca conectou",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      isOpen: false,
    };
  }

  const appState = resolveAppState(device);
  const isForeground =
    appState === "foreground" ||
    (appState === "unknown" && device.status === "online");

  if (isForeground) {
    return {
      label: "Aberto" as TvAppLabel,
      detail: `App em primeiro plano ${formatRelativeTime(device.last_seen_at!)}`,
      className: "border-success/40 bg-success/10 text-success",
      isOpen: true,
    };
  }

  return {
    label: "Fechado" as TvAppLabel,
    detail: `App em segundo plano ${formatRelativeTime(device.last_seen_at!)}`,
    className: "border-warning/40 bg-warning/10 text-warning",
    isOpen: false,
  };
}

/** Resumo legado para cards que ainda usam um único badge. */
export function getTvConnectionState(device?: TvDevice) {
  const power = getTvPowerState(device);
  const app = getTvAppState(device);

  if (!device) {
    return {
      label: "Sem app" as TvConnectionLabel,
      detail: app.detail,
      className: app.className,
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

  if (!power.isOn) {
    return {
      label: "Offline" as TvConnectionLabel,
      detail: `TV: ${power.label} · App: ${app.label}`,
      className: power.className,
      isOnline: false,
    };
  }

  return {
    label: "Online" as TvConnectionLabel,
    detail: `TV: ${power.label} · App: ${app.label}`,
    className: app.isOpen ? "border-success/40 bg-success/10 text-success" : app.className,
    isOnline: true,
  };
}

export function getConnectionDotClass(label: TvConnectionLabel, screenActive: boolean) {
  if (label === "Online") {
    return "bg-success shadow-[0_0_10px_var(--success)]";
  }
  if (label === "Aguardando pareamento") {
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
  let unpaired = 0;
  let enabled = 0;
  let appOpen = 0;

  for (const screen of screens) {
    if (screen.active) enabled += 1;
    const device = getPrimaryTvDevice(screen.id, tvDevices);
    const power = getTvPowerState(device);
    const app = getTvAppState(device);

    if (!device || device.status === "pending") {
      unpaired += 1;
      continue;
    }

    if (app.isOpen) appOpen += 1;

    if (power.isOn) {
      online += 1;
    } else {
      offline += 1;
    }
  }

  return {
    total: screens.length,
    online,
    offline,
    idle: screens.length - online - offline - unpaired,
    unpaired,
    enabled,
    disabled: screens.length - enabled,
    appOpen,
  };
}

function formatRelativeTime(value: string) {
  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return `há ${diffSeconds}s`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `há ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays} d`;
}
