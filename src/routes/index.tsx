import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Tv,
  Megaphone,
  LayoutDashboard,
  Plus,
  Play,
  Copy,
  Trash2,
  Pencil,
  RefreshCw,
  Power,
  ExternalLink,
  Sparkles,
  Database,
  Radio,
  Clock,
  LoaderCircle,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

import {
  listScreens,
  listAds,
  listLayoutTemplates,
  listTvDevices,
  createScreen,
  updateScreen,
  touchScreenPlaylist,
  deleteScreen,
  createAd,
  updateAd,
  deleteAd,
  createLayoutTemplate,
  updateLayoutTemplate,
  deleteLayoutTemplate,
} from "@/lib/data";
import {
  extractYouTubeId,
  getAdPlaybackStatus,
  getAdPlaybackStatusLabel,
  isAdRunningNow,
  sortAdsForPlayback,
} from "@/lib/ad-utils";
import { useAuth } from "@/lib/auth";
import { createLayoutRegionsFromPreset, getPresetLabel } from "@/lib/layout-presets";
import type {
  Ad,
  AdInput,
  AdOrientation,
  LayoutPresetId,
  LayoutRegionInput,
  LayoutTemplate,
  LayoutTemplateInput,
  MediaType,
  Orientation,
  Screen,
  ScreenDisplayMode,
  ScreenInput,
  TvDevice,
} from "@/lib/types";
import {
  isInlineMediaSource,
  supabaseEnabled,
  uploadAdMediaDataUri,
  uploadAdMediaFile,
} from "@/lib/supabase";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Dashboard,
});

const TV_ONLINE_WINDOW_MS = 35_000;
const TV_BACKGROUND_WINDOW_MS = 45_000;
const DISPLAY_MODE_OPTIONS: Array<{
  value: ScreenDisplayMode;
  label: string;
}> = [
  { value: "normal", label: "Normal" },
  { value: "rotate_90", label: "Vertical 90" },
  { value: "rotate_270", label: "Vertical 270" },
  { value: "fill", label: "Tela cheia" },
];

function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const screensQ = useQuery({
    queryKey: ["screens"],
    queryFn: listScreens,
    enabled: !!user,
  });
  const adsQ = useQuery({
    queryKey: ["ads"],
    queryFn: listAds,
    enabled: !!user,
  });
  const layoutsQ = useQuery({
    queryKey: ["layoutTemplates"],
    queryFn: listLayoutTemplates,
    enabled: !!user,
  });
  const tvDevicesQ = useQuery({
    queryKey: ["tvDevices"],
    queryFn: listTvDevices,
    enabled: !!user,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.navigate({ to: "/login", replace: true });
    }
  }, [loading, router, user]);

  if (loading) {
    return <FullScreenLoader text="Verificando sua sessão..." />;
  }

  if (!user) {
    return null;
  }

  const screens = screensQ.data ?? [];
  const ads = adsQ.data ?? [];
  const layouts = layoutsQ.data ?? [];
  const tvDevices = tvDevicesQ.data ?? [];
  const supportedAds = ads.filter((ad) => ad.type === "image" || ad.type === "video");

  const activeScreens = screens.filter((s) => s.active).length;
  const activeAds = supportedAds.filter((ad) => isAdRunningNow(ad)).length;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-8">
        <HeroHeader
          totalScreens={screens.length}
          activeScreens={activeScreens}
          totalAds={ads.length}
          activeAds={activeAds}
        />

        <Tabs defaultValue="overview" className="mt-10">
          <TabsList className="mb-6 h-11 gap-1 rounded-xl bg-card p-1 shadow-card">
            <TabsTrigger
              value="overview"
              className="gap-2 rounded-lg px-4 data-[state=active]:gradient-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-glow"
            >
              <LayoutDashboard className="h-4 w-4" /> Visão geral
            </TabsTrigger>
            <TabsTrigger
              value="screens"
              className="gap-2 rounded-lg px-4 data-[state=active]:gradient-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-glow"
            >
              <Tv className="h-4 w-4" /> TVs
              <Badge variant="secondary" className="ml-1">
                {screens.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="ads"
              className="gap-2 rounded-lg px-4 data-[state=active]:gradient-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-glow"
            >
              <Megaphone className="h-4 w-4" /> Anúncios
              <Badge variant="secondary" className="ml-1">
                {ads.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Overview screens={screens} ads={supportedAds} />
          </TabsContent>

          <TabsContent value="screens">
            <ScreensTab
              screens={screens}
              tvDevices={tvDevices}
              qc={qc}
              loading={screensQ.isLoading}
            />
          </TabsContent>

          <TabsContent value="ads">
            <AdsTab
              ads={supportedAds}
              screens={screens}
              qc={qc}
              loading={adsQ.isLoading}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------- Brand ----------
function BrandLogo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Midia Indoor"
      className={`rounded-xl object-cover shadow-glow ${className}`}
    />
  );
}

// ---------- Top bar ----------
function TopBar() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Midia Indoor</div>
            <div className="text-xs text-muted-foreground">
              Gestão de TVs & Campanhas
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              supabaseEnabled
                ? "border-success/40 bg-success/10 text-success"
                : "border-warning/40 bg-warning/10 text-warning"
            }
          >
            <Database className="mr-1.5 h-3 w-3" />
            {supabaseEnabled ? "Supabase conectado" : "Modo local"}
          </Badge>
          {user ? (
            <>
              <div className="hidden rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground md:block">
                {user.email}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await signOut();
                    toast.success("Sessão encerrada.");
                    router.navigate({ to: "/login" });
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function FullScreenLoader({ text }: { text: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="text-center">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

// ---------- Hero ----------
function HeroHeader({
  totalScreens,
  activeScreens,
  totalAds,
  activeAds,
}: {
  totalScreens: number;
  activeScreens: number;
  totalAds: number;
  activeAds: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card md:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full gradient-brand opacity-30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-[color:var(--brand-glow)] opacity-20 blur-3xl" />
      <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-[color:var(--brand-glow)]" />
            Painel atualizado
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Suas TVs, suas campanhas,{" "}
            <span className="bg-clip-text text-transparent gradient-brand">
              tudo no controle.
            </span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Cadastre telas, publique anúncios com imagem ou vídeo e abra o player
            em qualquer TV da sua rede.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="TVs" value={totalScreens} icon={<Tv className="h-4 w-4" />} />
          <Stat
            label="TVs ativas"
            value={activeScreens}
            icon={<Power className="h-4 w-4 text-success" />}
          />
          <Stat
            label="Anúncios"
            value={totalAds}
            icon={<Megaphone className="h-4 w-4" />}
          />
          <Stat
            label="No ar"
            value={activeAds}
            icon={<Radio className="h-4 w-4 text-[color:var(--brand-glow)]" />}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

// ---------- Overview ----------
function Overview({ screens, ads }: { screens: Screen[]; ads: Ad[] }) {
  const recentAds = ads.slice(0, 5);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" /> Últimas campanhas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAds.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="h-8 w-8" />}
              title="Nenhuma campanha ainda"
              description="Crie seu primeiro anúncio na aba Anúncios."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentAds.map((a) => (
                <RecentAdItem key={a.id} ad={a} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tv className="h-4 w-4" /> TVs cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {screens.length === 0 ? (
            <EmptyState
              icon={<Tv className="h-8 w-8" />}
              title="Nenhuma TV"
              description="Adicione uma TV para começar."
            />
          ) : (
            screens.slice(0, 6).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.location || "Sem local"}
                  </div>
                </div>
                <span
                  className={`h-2 w-2 rounded-full ${s.active ? "bg-success" : "bg-muted-foreground/40"}`}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getOrientationLabel(orientation: Orientation | AdOrientation | undefined) {
  switch (orientation) {
    case "portrait":
      return "Vertical";
    case "landscape":
      return "Horizontal";
    case "any":
    default:
      return "Qualquer";
  }
}

function getDisplayModeLabel(mode: ScreenDisplayMode | undefined) {
  switch (mode) {
    case "rotate_90":
      return "Vertical 90";
    case "rotate_270":
      return "Vertical 270";
    case "fill":
      return "Tela cheia";
    case "normal":
    default:
      return "Normal";
  }
}

function getDisplayModeTransform(
  mode: ScreenDisplayMode | undefined,
  orientation: Orientation = "landscape",
) {
  switch (mode) {
    case "rotate_90":
      return "rotate(90deg)";
    case "rotate_270":
      return "rotate(-90deg)";
    case "fill":
      return orientation === "portrait" ? "rotate(90deg)" : "scale(1.05)";
    case "normal":
    default:
      return orientation === "portrait" ? "rotate(90deg)" : "none";
  }
}

function DisplayModeButtons({
  value,
  onChange,
}: {
  value: ScreenDisplayMode;
  onChange: (value: ScreenDisplayMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DISPLAY_MODE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          className={value === option.value ? "gradient-brand text-brand-foreground" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function ScreenDisplayPreview({
  orientation,
  displayMode,
  className = "",
}: {
  orientation: Orientation;
  displayMode: ScreenDisplayMode;
  className?: string;
}) {
  const isRotated = displayMode === "rotate_90" || displayMode === "rotate_270";
  const isPortraitAsset = orientation === "portrait";
  const showRotatedPortrait = isRotated || isPortraitAsset;
  const innerWidth = showRotatedPortrait ? "56.25%" : "74%";
  const innerHeight = showRotatedPortrait ? "177.78%" : "42%";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border/70 bg-[#050816] ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.28),transparent_48%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.18),transparent_45%)]" />
      <div className="absolute inset-3 rounded-xl border border-white/8 bg-black/40" />
      <div
        className="absolute left-1/2 top-1/2 rounded-xl border border-white/15 bg-gradient-to-br from-fuchsia-500/60 via-cyan-400/35 to-emerald-400/55 shadow-[0_0_40px_rgba(124,58,237,0.25)] transition-transform"
        style={{
          width: innerWidth,
          height: innerHeight,
          transform: `translate(-50%, -50%) ${getDisplayModeTransform(displayMode, orientation)}`,
        }}
      >
        <div className="absolute inset-2 rounded-lg border border-white/15" />
      </div>
      <div className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-1 text-[10px] text-white/80">
        {getDisplayModeLabel(displayMode)}
      </div>
    </div>
  );
}

function getPrimaryTvDevice(screenId: string, tvDevices: TvDevice[]) {
  return [...tvDevices]
    .filter((device) => device.screen_id === screenId)
    .sort((left, right) => {
      const rightTime = new Date(right.last_seen_at ?? right.created_at).getTime();
      const leftTime = new Date(left.last_seen_at ?? left.created_at).getTime();
      return rightTime - leftTime;
    })[0];
}

function getTvConnectionState(device?: TvDevice) {
  if (!device) {
    return {
      label: "Sem app",
      detail: "Nenhum dispositivo pareado",
      className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    };
  }

  if (device.status === "pending") {
    return {
      label: "Pendente",
      detail: "Dispositivo criado, aguardando pareamento",
      className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    };
  }

  if (device.last_seen_at) {
    const elapsed = Date.now() - new Date(device.last_seen_at).getTime();

    if (device.status === "idle" && elapsed <= TV_BACKGROUND_WINDOW_MS) {
      return {
        label: "App fechado",
        detail: `TV saiu do app ${formatRelativeTime(device.last_seen_at)}`,
        className: "border-warning/40 bg-warning/10 text-warning",
      };
    }

    if (elapsed <= TV_ONLINE_WINDOW_MS) {
      return {
        label: "Online",
        detail: `App ativa ${formatRelativeTime(device.last_seen_at)}`,
        className: "border-success/40 bg-success/10 text-success",
      };
    }
  }

  return {
    label: "Offline",
    detail: device.last_seen_at
      ? `Sem sinal ${formatRelativeTime(device.last_seen_at)}`
      : "Pareada, mas sem sinal do app",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
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

function createEmptyRegion(): LayoutRegionInput {
  return {
    name: "Nova região",
    region_type: "media",
    x: 0,
    y: 0,
    width: 960,
    height: 540,
    z_index: 1,
    background: "transparent",
    items: [],
  };
}

function createMediaRegionItem() {
  return {
    item_type: "ad" as const,
    ad_id: null,
    title: "",
    banner_text: null,
    background: "#111827",
    text_color: "#ffffff",
    fit_mode: "cover" as const,
    position: 1,
    active: true,
  };
}

function createBannerRegionItem() {
  return {
    item_type: "banner" as const,
    ad_id: null,
    title: "Banner",
    banner_text: "Texto do banner",
    background: "#111827",
    text_color: "#ffffff",
    fit_mode: "cover" as const,
    position: 1,
    active: true,
  };
}

// ---------- Screens tab ----------
function ScreensTab({
  screens,
  tvDevices,
  qc,
  loading,
}: {
  screens: Screen[];
  tvDevices: TvDevice[];
  qc: ReturnType<typeof useQueryClient>;
  loading: boolean;
}) {
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Screen | null>(null);
  const [deleting, setDeleting] = useState<Screen | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => deleteScreen(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screens"] });
      qc.invalidateQueries({ queryKey: ["ads"] });
      toast.success("TV excluída");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (s: Screen) => updateScreen(s.id, { active: !s.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["screens"] }),
  });

  const refreshMut = useMutation({
    mutationFn: (screenId: string) => touchScreenPlaylist(screenId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screens"] });
      toast.success("Atualização enviada para a TV");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const displayModeMut = useMutation({
    mutationFn: ({
      screenId,
      displayMode,
    }: {
      screenId: string;
      displayMode: ScreenDisplayMode;
    }) => updateScreen(screenId, { display_mode: displayMode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screens"] });
      toast.success("Modo de exibição atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <SectionHeader
        title="Suas TVs"
        description="Cada TV tem seu próprio link de player."
        action={
          <Button onClick={() => setOpenCreate(true)} className="gradient-brand text-brand-foreground shadow-glow">
            <Plus /> Nova TV
          </Button>
        }
      />

      {loading ? (
        <SkeletonGrid />
      ) : screens.length === 0 ? (
        <EmptyState
          icon={<Tv className="h-8 w-8" />}
          title="Cadastre sua primeira TV"
          description="Depois basta abrir o link do player na TV correspondente."
          action={
            <Button onClick={() => setOpenCreate(true)} className="gradient-brand text-brand-foreground">
              <Plus /> Nova TV
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {screens.map((s) => (
            <ScreenCard
              key={s.id}
              screen={s}
              tvDevice={getPrimaryTvDevice(s.id, tvDevices)}
              onEdit={() => setEditing(s)}
              onDelete={() => setDeleting(s)}
              onToggle={() => toggleMut.mutate(s)}
              onRefresh={() => refreshMut.mutate(s.id)}
              onDisplayModeChange={(displayMode) =>
                displayModeMut.mutate({ screenId: s.id, displayMode })
              }
            />
          ))}
        </div>
      )}

      <ScreenFormDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        onSubmit={async (values) => {
          try {
            await createScreen(values);
            qc.invalidateQueries({ queryKey: ["screens"] });
            toast.success("TV criada");
            setOpenCreate(false);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <ScreenFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing ?? undefined}
        onSubmit={async (values) => {
          if (!editing) return;
          try {
            await updateScreen(editing.id, {
              name: values.name,
              location: values.location,
              active: values.active,
              orientation: values.orientation,
              display_mode: values.display_mode ?? "normal",
              resolution_width: values.resolution_width,
              resolution_height: values.resolution_height,
              layout_template_id: null,
            });
            qc.invalidateQueries({ queryKey: ["screens"] });
            toast.success("TV atualizada");
            setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir esta TV?"
        description={`A TV "${deleting?.name}" será removida junto com todos os vínculos de anúncios.`}
        confirmLabel="Excluir"
        onConfirm={() => deleting && delMut.mutate(deleting.id)}
      />
    </div>
  );
}

function ScreenCard({
  screen,
  tvDevice,
  onEdit,
  onDelete,
  onToggle,
  onRefresh,
  onDisplayModeChange,
}: {
  screen: Screen;
  tvDevice?: TvDevice;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onRefresh: () => void;
  onDisplayModeChange: (displayMode: ScreenDisplayMode) => void;
}) {
  const playerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/player/${screen.id}`
      : `/player/${screen.id}`;
  const connectionState = getTvConnectionState(tvDevice);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition hover:border-[color:var(--brand)]/40">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full gradient-brand opacity-0 blur-3xl transition group-hover:opacity-20" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${screen.active ? "bg-success shadow-[0_0_10px_var(--success)]" : "bg-muted-foreground/40"}`}
            />
            <h3 className="truncate text-base font-semibold">{screen.name}</h3>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {screen.location || "Sem local"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Screen ID:</span>
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-foreground">
              {screen.id}
            </code>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">
              {getOrientationLabel(screen.orientation)}
            </Badge>
            <Badge variant="secondary">
              {screen.resolution_width}x{screen.resolution_height}
            </Badge>
            <Badge variant="outline">
              {getDisplayModeLabel(screen.display_mode ?? "normal")}
            </Badge>
            <Badge className={connectionState.className}>{connectionState.label}</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {connectionState.detail}
            {tvDevice?.device_name ? ` · ${tvDevice.device_name}` : ""}
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                Teste rápido de exibição
              </Label>
              <div className="mt-2">
                <DisplayModeButtons
                  value={screen.display_mode ?? "normal"}
                  onChange={onDisplayModeChange}
                />
              </div>
            </div>
            <ScreenDisplayPreview
              orientation={screen.orientation ?? "landscape"}
              displayMode={screen.display_mode ?? "normal"}
              className="aspect-video"
            />
          </div>
        </div>
        <Switch checked={screen.active} onCheckedChange={onToggle} />
      </div>

      <Separator className="my-4" />

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="gradient-brand text-brand-foreground">
          <Link to="/player/$screenId" params={{ screenId: screen.id }} target="_blank">
            <Play /> Abrir player
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(playerUrl);
            toast.success("Link copiado");
          }}
        >
          <Copy /> Link
        </Button>
        <Button size="sm" variant="outline" onClick={onRefresh}>
          <RefreshCw /> Atualizar TV
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil /> Editar
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

function ScreenFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: ScreenInput) => void;
  initial?: Screen;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [id, setId] = useState(initial?.id ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [orientation, setOrientation] = useState<Orientation>(
    initial?.orientation ?? "landscape",
  );
  const [displayMode, setDisplayMode] = useState<ScreenDisplayMode>(
    initial?.display_mode ?? "normal",
  );
  const [resolutionWidth, setResolutionWidth] = useState(
    initial?.resolution_width ?? 1920,
  );
  const [resolutionHeight, setResolutionHeight] = useState(
    initial?.resolution_height ?? 1080,
  );

  // reset when opening
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setLocation(initial?.location ?? "");
      setId(initial?.id ?? "");
      setActive(initial?.active ?? true);
      setOrientation(initial?.orientation ?? "landscape");
      setDisplayMode(initial?.display_mode ?? "normal");
      setResolutionWidth(initial?.resolution_width ?? 1920);
      setResolutionHeight(initial?.resolution_height ?? 1080);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar TV" : "Nova TV"}</DialogTitle>
          <DialogDescription>
            Configure os dados da TV. O Screen ID e usado na ativacao do app da TV e no link do player.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="TV Recepção"
            />
          </div>
          <div>
            <Label>Local</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Academia — Recepção"
            />
          </div>
          {initial ? (
            <div>
              <Label>Screen ID</Label>
              <Input value={initial.id} readOnly />
              <p className="mt-1 text-xs text-muted-foreground">
                Use este valor na tela de ativacao do app da TV.
              </p>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Orientação</Label>
              <Select
                value={orientation}
                onValueChange={(value) => setOrientation(value as Orientation)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Horizontal</SelectItem>
                  <SelectItem value="portrait">Vertical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modo de exibição</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Teste rápido para ver como o conteúdo deve aparecer na TV.
              </p>
              <DisplayModeButtons value={displayMode} onChange={setDisplayMode} />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Preview</Label>
            <ScreenDisplayPreview
              orientation={orientation}
              displayMode={displayMode}
              className="aspect-video"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Resolução largura</Label>
              <Input
                type="number"
                min={1}
                value={resolutionWidth}
                onChange={(e) => setResolutionWidth(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Resolução altura</Label>
              <Input
                type="number"
                min={1}
                value={resolutionHeight}
                onChange={(e) => setResolutionHeight(Number(e.target.value))}
              />
            </div>
          </div>
          {!initial && (
            <div>
              <Label>Screen ID (opcional)</Label>
              <Input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="tv-recepcao"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Deixe em branco para gerar automaticamente a partir do nome.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <Label className="text-sm">Ativa</Label>
              <p className="text-xs text-muted-foreground">
                TVs inativas não exibem anúncios.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-brand text-brand-foreground"
            onClick={() =>
              onSubmit({
                name,
                location,
                active,
                orientation,
                display_mode: displayMode,
                resolution_width: resolutionWidth,
                resolution_height: resolutionHeight,
                layout_template_id: null,
                id: id || undefined,
              })
            }
          >
            {initial ? "Salvar" : "Criar TV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Ads tab ----------
function AdsTab({
  ads,
  screens,
  qc,
  loading,
}: {
  ads: Ad[];
  screens: Screen[];
  qc: ReturnType<typeof useQueryClient>;
  loading: boolean;
}) {
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [deleting, setDeleting] = useState<Ad | null>(null);
  const orderedAds = useMemo(
    () => sortAdsForPlayback(ads.filter((ad) => ad.type === "image" || ad.type === "video")),
    [ads],
  );

  const delMut = useMutation({
    mutationFn: (id: string) => deleteAd(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads"] });
      toast.success("Anúncio excluído");
      setDeleting(null);
    },
  });
  const toggleMut = useMutation({
    mutationFn: (a: Ad) => updateAd(a.id, { active: !a.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ads"] }),
  });

  const migrateMut = useMutation({
    mutationFn: async (ad: Ad) => {
      if (!isInlineMediaSource(ad.source)) return;

      const extension = ad.type === "video" ? "mp4" : "png";
      const uploadedSource = await uploadAdMediaDataUri(
        ad.source,
        `${ad.title || "anuncio"}.${extension}`,
      );

      await updateAd(ad.id, { source: uploadedSource });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads"] });
      toast.success("Mídia migrada para Storage");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <SectionHeader
        title="Campanhas"
        description="Imagem ou vídeo em uma ou várias TVs."
        action={
          <Button
            onClick={() => setOpenCreate(true)}
            disabled={screens.length === 0}
            className="gradient-brand text-brand-foreground shadow-glow"
          >
            <Plus /> Novo anúncio
          </Button>
        }
      />

      {screens.length === 0 && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Cadastre pelo menos uma TV antes de criar anúncios.
        </div>
      )}

      {loading ? (
        <SkeletonGrid />
      ) : orderedAds.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" />}
          title="Nenhum anúncio criado"
          description="Suba uma imagem ou vídeo para exibir nas TVs."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orderedAds.map((a) => (
            <AdCard
              key={a.id}
              ad={a}
              screens={screens}
              onEdit={() => setEditing(a)}
              onDelete={() => setDeleting(a)}
              onToggle={() => toggleMut.mutate(a)}
              onMigrateInline={
                isInlineMediaSource(a.source)
                  ? () => migrateMut.mutate(a)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <AdFormDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        screens={screens}
        onSubmit={async (v) => {
          try {
            await createAd(v);
            qc.invalidateQueries({ queryKey: ["ads"] });
            toast.success("Anúncio criado");
            setOpenCreate(false);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <AdFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        screens={screens}
        initial={editing ?? undefined}
        onSubmit={async (v) => {
          if (!editing) return;
          try {
            await updateAd(editing.id, v);
            qc.invalidateQueries({ queryKey: ["ads"] });
            toast.success("Anúncio atualizado");
            setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir este anúncio?"
        description={`"${deleting?.title}" será removido permanentemente.`}
        confirmLabel="Excluir"
        onConfirm={() => deleting && delMut.mutate(deleting.id)}
      />
    </div>
  );
}

function AdCard({
  ad,
  screens,
  onEdit,
  onDelete,
  onToggle,
  onMigrateInline,
}: {
  ad: Ad;
  screens: Screen[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onMigrateInline?: () => void;
}) {
  const linked = screens.filter((s) => ad.screen_ids.includes(s.id));
  const status = getAdPlaybackStatus(ad);
  const statusLabel = getAdPlaybackStatusLabel(status);

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:border-[color:var(--brand)]/40">
      <div className="relative aspect-video overflow-hidden bg-muted">
        <MediaThumb ad={ad} className="h-full w-full" />
        <Badge
          className="absolute left-3 top-3 backdrop-blur"
          variant={status === "live" ? "default" : status === "paused" ? "secondary" : "outline"}
        >
          {statusLabel}
        </Badge>
        <Badge variant="outline" className="absolute right-3 top-3 border-white/30 bg-black/40 text-white backdrop-blur">
          {ad.type === "video" ? "Vídeo" : "Imagem"}
        </Badge>
      </div>
      <div className="p-4">
        <h3 className="truncate text-base font-semibold">{ad.title}</h3>
        <p className="truncate text-xs text-muted-foreground">
          {ad.advertiser || "Sem anunciante"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Tv className="h-3 w-3" /> {getOrientationLabel(ad.preferred_orientation)}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Play className="h-3 w-3" /> Ordem #{ad.position}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {ad.duration}s
          </span>
          <span>·</span>
          <span>{linked.length} TV(s)</span>
        </div>
        {status !== "live" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {getPlaybackScheduleMessage(ad, status)}
          </p>
        ) : null}
        {linked.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {linked.slice(0, 3).map((s) => (
              <Badge key={s.id} variant="outline" className="text-[10px]">
                {s.name}
              </Badge>
            ))}
            {linked.length > 3 && (
              <Badge variant="outline" className="text-[10px]">
                +{linked.length - 3}
              </Badge>
            )}
          </div>
        )}
        <Separator className="my-4" />
        <div className="flex items-center justify-between">
          <Switch checked={ad.active} onCheckedChange={onToggle} />
          <div className="flex gap-1">
            {onMigrateInline ? (
              <Button size="sm" variant="outline" onClick={onMigrateInline}>
                <RefreshCw /> Migrar mídia
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil /> Editar
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdFormDialog({
  open,
  onOpenChange,
  screens,
  onSubmit,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  screens: Screen[];
  onSubmit: (v: AdInput) => void;
  initial?: Ad;
}) {
  const [title, setTitle] = useState("");
  const [advertiser, setAdvertiser] = useState("");
  const [type, setType] = useState<MediaType>("image");
  const [preferredOrientation, setPreferredOrientation] =
    useState<AdOrientation>("any");
  const [source, setSource] = useState("");
  const [duration, setDuration] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setAdvertiser(initial?.advertiser ?? "");
      setType(initial?.type === "video" ? "video" : "image");
      setPreferredOrientation(initial?.preferred_orientation ?? "any");
      setSource(initial?.source ?? "");
      setDuration(initial?.duration ?? 10);
      setSelected(initial?.screen_ids ?? []);
      setActive(initial?.active ?? true);
      setStartsAt(initial?.starts_at?.slice(0, 16) ?? "");
      setEndsAt(initial?.ends_at?.slice(0, 16) ?? "");
      setSelectedFile(null);
      setSubmitting(false);
    }
  }, [open, initial]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setSource(String(reader.result || ""));
    reader.readAsDataURL(file);
    if (file.type.startsWith("video")) setType("video");
    else if (file.type.startsWith("image")) setType("image");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar anúncio" : "Novo anúncio"}</DialogTitle>
          <DialogDescription>
            Escolha o tipo de mídia, o tempo em tela e as TVs onde vai aparecer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Anunciante</Label>
            <Input
              value={advertiser}
              onChange={(e) => setAdvertiser(e.target.value)}
            />
          </div>
          <div>
            <Label>Tipo de mídia</Label>
            <Select value={type} onValueChange={(v) => setType(v as MediaType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Duração (segundos)</Label>
            <Input
              type="number"
              min={3}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Orientação preferida</Label>
            <Select
              value={preferredOrientation}
              onValueChange={(value) =>
                setPreferredOrientation(value as AdOrientation)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="landscape">Horizontal</SelectItem>
                <SelectItem value="portrait">Vertical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>URL da mídia</Label>
            <Textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://exemplo.com/banner.jpg"
              rows={2}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Ou envie um arquivo</Label>
            <Input
              type="file"
              accept={type === "video" ? "video/*" : "image/*"}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Início (opcional)</Label>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Deixe em branco para começar a exibir imediatamente.
            </p>
          </div>
          <div>
            <Label>Fim (opcional)</Label>
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Se preencher, o anúncio some do player após esse horário.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Label className="mb-2 block">Exibir nas TVs</Label>
          {screens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre uma TV primeiro.
            </p>
          ) : (
            <div className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-2">
              {screens.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <Checkbox
                    checked={selected.includes(s.id)}
                    onCheckedChange={(v) => {
                      setSelected((cur) =>
                        v ? [...cur, s.id] : cur.filter((x) => x !== s.id),
                      );
                    }}
                  />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 p-3">
          <div>
            <Label className="text-sm">Ativo</Label>
            <p className="text-xs text-muted-foreground">
              Anúncios inativos não aparecem no player.
            </p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-brand text-brand-foreground"
            disabled={!title || (!source && !selectedFile) || submitting}
            onClick={async () => {
              try {
                setSubmitting(true);

                let finalSource = source;

                if (supabaseEnabled) {
                  if (selectedFile) {
                    finalSource = await uploadAdMediaFile(selectedFile);
                  } else if (isInlineMediaSource(source)) {
                    const extension = type === "video" ? "mp4" : "png";
                    finalSource = await uploadAdMediaDataUri(
                      source,
                      `${title || "anuncio"}.${extension}`,
                    );
                  }
                }

                await onSubmit({
                  title,
                  advertiser,
                  type,
                  source: finalSource,
                  duration,
                  preferred_orientation: preferredOrientation,
                  screen_ids: selected,
                  active,
                  starts_at: startsAt ? new Date(startsAt).toISOString() : null,
                  ends_at: endsAt ? new Date(endsAt).toISOString() : null,
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? (
              <>
                <LoaderCircle className="animate-spin" /> Enviando mídia
              </>
            ) : initial ? (
              "Salvar"
            ) : (
              "Criar anúncio"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Layouts tab ----------
function LayoutsTab({
  layouts,
  ads,
  screens,
  qc,
  loading,
}: {
  layouts: LayoutTemplate[];
  ads: Ad[];
  screens: Screen[];
  qc: ReturnType<typeof useQueryClient>;
  loading: boolean;
}) {
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<LayoutTemplate | null>(null);
  const [deleting, setDeleting] = useState<LayoutTemplate | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => deleteLayoutTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["layoutTemplates"] });
      qc.invalidateQueries({ queryKey: ["screens"] });
      toast.success("Layout excluído");
      setDeleting(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <SectionHeader
        title="Layouts"
        description="Monte composições dinâmicas com áreas de mídia e banner para TVs horizontais e verticais."
        action={
          <Button
            onClick={() => setOpenCreate(true)}
            className="gradient-brand text-brand-foreground shadow-glow"
          >
            <Plus /> Novo layout
          </Button>
        }
      />

      {loading ? (
        <SkeletonGrid />
      ) : layouts.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="Nenhum layout criado"
          description="Crie templates reutilizáveis para diferentes orientações e grades de conteúdo."
          action={
            <Button
              onClick={() => setOpenCreate(true)}
              className="gradient-brand text-brand-foreground"
            >
              <Plus /> Novo layout
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {layouts.map((layout) => (
            <LayoutTemplateCard
              key={layout.id}
              layout={layout}
              screens={screens}
              onEdit={() => setEditing(layout)}
              onDelete={() => setDeleting(layout)}
            />
          ))}
        </div>
      )}

      <LayoutTemplateFormDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        ads={ads}
        onSubmit={async (values) => {
          try {
            await createLayoutTemplate(values);
            qc.invalidateQueries({ queryKey: ["layoutTemplates"] });
            toast.success("Layout criado");
            setOpenCreate(false);
          } catch (error) {
            toast.error((error as Error).message);
          }
        }}
      />

      <LayoutTemplateFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        ads={ads}
        initial={editing ?? undefined}
        onSubmit={async (values) => {
          if (!editing) return;
          try {
            await updateLayoutTemplate(editing.id, values);
            qc.invalidateQueries({ queryKey: ["layoutTemplates"] });
            qc.invalidateQueries({ queryKey: ["screens"] });
            toast.success("Layout atualizado");
            setEditing(null);
          } catch (error) {
            toast.error((error as Error).message);
          }
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir este layout?"
        description={`"${deleting?.name}" será removido. TVs vinculadas ficarão sem template até que você escolha outro.`}
        confirmLabel="Excluir"
        onConfirm={() => deleting && delMut.mutate(deleting.id)}
      />
    </div>
  );
}

function LayoutTemplateCard({
  layout,
  screens,
  onEdit,
  onDelete,
}: {
  layout: LayoutTemplate;
  screens: Screen[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const linkedScreens = screens.filter(
    (screen) => screen.layout_template_id === layout.id,
  ).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="border-b border-border/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{layout.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {layout.description || "Sem descrição"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">
                {getOrientationLabel(layout.orientation)}
              </Badge>
              <Badge variant="secondary">
                {layout.canvas_width}x{layout.canvas_height}
              </Badge>
              <Badge variant="outline">
                {layout.regions?.length ?? 0} regiões
              </Badge>
              <Badge variant="outline">{linkedScreens} TV(s)</Badge>
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil /> Editar
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4">
        <LayoutPreview
          canvasWidth={layout.canvas_width}
          canvasHeight={layout.canvas_height}
          regions={layout.regions ?? []}
        />
      </div>
    </div>
  );
}

function LayoutPreview({
  canvasWidth,
  canvasHeight,
  regions,
}: {
  canvasWidth: number;
  canvasHeight: number;
  regions: LayoutRegionInput[] | LayoutTemplate["regions"];
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/40"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
    >
      {(regions ?? []).map((region, index) => {
        const left = (region.x / canvasWidth) * 100;
        const top = (region.y / canvasHeight) * 100;
        const width = (region.width / canvasWidth) * 100;
        const height = (region.height / canvasHeight) * 100;
        const background =
          region.background && region.background !== "transparent"
            ? region.background
            : region.region_type === "banner"
              ? "#111827"
              : "rgba(255,255,255,0.08)";

        return (
          <div
            key={"id" in region ? region.id : `${region.name}-${index}`}
            className="absolute rounded-lg border border-white/20 p-2 text-[10px] text-white shadow-sm"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              background,
              zIndex: region.z_index,
            }}
          >
            <div className="font-medium">{region.name}</div>
            <div className="opacity-80">
              {region.region_type === "banner" ? "Banner" : "Mídia"}
            </div>
            {"items" in region && region.items?.length ? (
              <div className="mt-1 opacity-70">{region.items.length} item(ns)</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function LayoutTemplateFormDialog({
  open,
  onOpenChange,
  ads,
  onSubmit,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ads: Ad[];
  onSubmit: (values: LayoutTemplateInput) => void;
  initial?: LayoutTemplate;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [preset, setPreset] = useState<LayoutPresetId>("fullscreen");
  const [canvasWidth, setCanvasWidth] = useState(1920);
  const [canvasHeight, setCanvasHeight] = useState(1080);
  const [active, setActive] = useState(true);
  const [regions, setRegions] = useState<LayoutRegionInput[]>([]);

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setName(initial.name);
      setDescription(initial.description);
      setOrientation(initial.orientation);
      setCanvasWidth(initial.canvas_width);
      setCanvasHeight(initial.canvas_height);
      setActive(initial.active);
      setRegions(
        (initial.regions ?? []).map((region) => ({
          name: region.name,
          region_type: region.region_type,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          z_index: region.z_index,
          background: region.background,
          items: (region.items ?? []).map((item) => ({
            item_type: item.item_type,
            ad_id: item.ad_id,
            title: item.title,
            banner_text: item.banner_text,
            background: item.background,
            text_color: item.text_color,
            fit_mode: item.fit_mode,
            position: item.position,
            active: item.active,
          })),
        })),
      );
      setPreset("fullscreen");
      return;
    }

    setName("");
    setDescription("");
    setOrientation("landscape");
    setCanvasWidth(1920);
    setCanvasHeight(1080);
    setActive(true);
    setPreset("main_with_banner");
    setRegions(createLayoutRegionsFromPreset("main_with_banner", "landscape"));
  }, [initial, open]);

  const applyPreset = () => {
    const nextRegions = createLayoutRegionsFromPreset(preset, orientation);
    setRegions(nextRegions);
    if (orientation === "portrait") {
      setCanvasWidth(1080);
      setCanvasHeight(1920);
    } else {
      setCanvasWidth(1920);
      setCanvasHeight(1080);
    }
  };

  const updateRegion = (
    regionIndex: number,
    patch: Partial<LayoutRegionInput>,
  ) => {
    setRegions((current) =>
      current.map((region, index) =>
        index === regionIndex ? { ...region, ...patch } : region,
      ),
    );
  };

  const updateRegionItems = (
    regionIndex: number,
    updater: (items: NonNullable<LayoutRegionInput["items"]>) => LayoutRegionInput["items"],
  ) => {
    setRegions((current) =>
      current.map((region, index) =>
        index === regionIndex
          ? { ...region, items: updater(region.items ?? []) }
          : region,
      ),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar layout" : "Novo layout"}</DialogTitle>
          <DialogDescription>
            Monte a grade visual da TV com regiões independentes de mídia e banner.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Orientação</Label>
                <Select
                  value={orientation}
                  onValueChange={(value) => setOrientation(value as Orientation)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Horizontal</SelectItem>
                    <SelectItem value="portrait">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <Label>Preset inicial</Label>
                <Select
                  value={preset}
                  onValueChange={(value) => setPreset(value as LayoutPresetId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "fullscreen",
                        "main_with_banner",
                        "split_vertical",
                        "split_horizontal",
                        "grid_2x2",
                      ] as LayoutPresetId[]
                    ).map((presetId) => (
                      <SelectItem key={presetId} value={presetId}>
                        {getPresetLabel(presetId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={applyPreset}>
                  Aplicar preset
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Canvas largura</Label>
                <Input
                  type="number"
                  min={1}
                  value={canvasWidth}
                  onChange={(e) => setCanvasWidth(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Canvas altura</Label>
                <Input
                  type="number"
                  min={1}
                  value={canvasHeight}
                  onChange={(e) => setCanvasHeight(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end">
                <div className="flex w-full items-center justify-between rounded-lg border border-border/60 p-3">
                  <div>
                    <Label className="text-sm">Ativo</Label>
                  </div>
                  <Switch checked={active} onCheckedChange={setActive} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Regiões</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRegions((current) => [...current, createEmptyRegion()])
                  }
                >
                  <Plus /> Adicionar região
                </Button>
              </div>

              {regions.map((region, regionIndex) => (
                <div
                  key={`${region.name}-${regionIndex}`}
                  className="space-y-4 rounded-xl border border-border/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid flex-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={region.name}
                          onChange={(e) =>
                            updateRegion(regionIndex, { name: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Tipo</Label>
                        <Select
                          value={region.region_type}
                          onValueChange={(value) =>
                            updateRegion(regionIndex, {
                              region_type: value as LayoutRegionInput["region_type"],
                              items:
                                value === "banner"
                                  ? region.items?.length
                                    ? region.items
                                    : [createBannerRegionItem()]
                                  : region.items,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="media">Mídia</SelectItem>
                            <SelectItem value="banner">Banner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setRegions((current) =>
                          current.filter((_, index) => index !== regionIndex),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    {(
                      [
                        ["x", region.x],
                        ["y", region.y],
                        ["width", region.width],
                        ["height", region.height],
                        ["z_index", region.z_index],
                      ] as const
                    ).map(([field, value]) => (
                      <div key={field}>
                        <Label>{field}</Label>
                        <Input
                          type="number"
                          min={field === "z_index" ? 1 : 0}
                          value={value}
                          onChange={(e) =>
                            updateRegion(regionIndex, {
                              [field]: Number(e.target.value),
                            } as Partial<LayoutRegionInput>)
                          }
                        />
                      </div>
                    ))}
                    <div className="md:col-span-3 lg:col-span-1">
                      <Label>Fundo</Label>
                      <Input
                        value={region.background}
                        onChange={(e) =>
                          updateRegion(regionIndex, {
                            background: e.target.value,
                          })
                        }
                        placeholder="transparent"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <Label>Itens da região</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateRegionItems(regionIndex, (items) => [
                            ...items,
                            region.region_type === "banner"
                              ? createBannerRegionItem()
                              : createMediaRegionItem(),
                          ])
                        }
                      >
                        <Plus /> Adicionar item
                      </Button>
                    </div>

                    {(region.items ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum item nessa região ainda.
                      </p>
                    ) : (
                      (region.items ?? []).map((item, itemIndex) => (
                        <div
                          key={`${item.item_type}-${itemIndex}`}
                          className="space-y-3 rounded-lg border border-border/60 bg-card p-3"
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="outline">
                              {item.item_type === "banner" ? "Banner" : "Anúncio"}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                updateRegionItems(regionIndex, (items) =>
                                  items.filter((_, index) => index !== itemIndex),
                                )
                              }
                            >
                              <Trash2 />
                            </Button>
                          </div>

                          {item.item_type === "ad" ? (
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="md:col-span-2">
                                <Label>Anúncio</Label>
                                <Select
                                  value={item.ad_id ?? "__none__"}
                                  onValueChange={(value) =>
                                    updateRegionItems(regionIndex, (items) =>
                                      items.map((currentItem, index) =>
                                        index === itemIndex
                                          ? {
                                              ...currentItem,
                                              ad_id:
                                                value === "__none__"
                                                  ? null
                                                  : value,
                                            }
                                          : currentItem,
                                      ),
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">
                                      Sem anúncio
                                    </SelectItem>
                                    {ads.map((ad) => (
                                      <SelectItem key={ad.id} value={ad.id}>
                                        {ad.title}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Ordem</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.position}
                                  onChange={(e) =>
                                    updateRegionItems(regionIndex, (items) =>
                                      items.map((currentItem, index) =>
                                        index === itemIndex
                                          ? {
                                              ...currentItem,
                                              position: Number(e.target.value),
                                            }
                                          : currentItem,
                                      ),
                                    )
                                  }
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <Label>Título</Label>
                                <Input
                                  value={item.title}
                                  onChange={(e) =>
                                    updateRegionItems(regionIndex, (items) =>
                                      items.map((currentItem, index) =>
                                        index === itemIndex
                                          ? {
                                              ...currentItem,
                                              title: e.target.value,
                                            }
                                          : currentItem,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <Label>Texto</Label>
                                <Input
                                  value={item.banner_text ?? ""}
                                  onChange={(e) =>
                                    updateRegionItems(regionIndex, (items) =>
                                      items.map((currentItem, index) =>
                                        index === itemIndex
                                          ? {
                                              ...currentItem,
                                              banner_text: e.target.value,
                                            }
                                          : currentItem,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <Label>Fundo</Label>
                                <Input
                                  value={item.background}
                                  onChange={(e) =>
                                    updateRegionItems(regionIndex, (items) =>
                                      items.map((currentItem, index) =>
                                        index === itemIndex
                                          ? {
                                              ...currentItem,
                                              background: e.target.value,
                                            }
                                          : currentItem,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <Label>Cor do texto</Label>
                                <Input
                                  value={item.text_color}
                                  onChange={(e) =>
                                    updateRegionItems(regionIndex, (items) =>
                                      items.map((currentItem, index) =>
                                        index === itemIndex
                                          ? {
                                              ...currentItem,
                                              text_color: e.target.value,
                                            }
                                          : currentItem,
                                      ),
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Preview</Label>
              <LayoutPreview
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                regions={regions}
              />
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              O preview mostra a estrutura da grade. O player da TV passará a ler
              esse layout por regiões, respeitando orientação, ordem e banners.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-brand text-brand-foreground"
            disabled={!name || regions.length === 0}
            onClick={() =>
              onSubmit({
                name,
                description,
                orientation,
                canvas_width: canvasWidth,
                canvas_height: canvasHeight,
                active,
                regions,
              })
            }
          >
            {initial ? "Salvar layout" : "Criar layout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Shared ----------
function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-2xl border border-border bg-card"
        />
      ))}
    </div>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MediaThumb({ ad, className }: { ad: Ad; className?: string }) {
  if (ad.type === "video") {
    return (
      <div className={`grid place-items-center bg-muted text-muted-foreground ${className}`}>
        <Play className="h-6 w-6" />
      </div>
    );
  }
  return ad.source ? (
    <img src={ad.source} alt={ad.title} className={`object-cover ${className}`} />
  ) : (
    <div className={`bg-muted ${className}`} />
  );
}

function RecentAdItem({ ad }: { ad: Ad }) {
  const status = getAdPlaybackStatus(ad);
  const statusLabel = getAdPlaybackStatusLabel(status);

  return (
    <li className="flex items-center gap-3 py-3">
      <MediaThumb ad={ad} className="h-12 w-16 rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{ad.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {ad.advertiser || "Sem anunciante"} · {ad.duration}s ·{" "}
          {ad.screen_ids.length} TV(s)
        </div>
      </div>
      <Badge
        variant={status === "live" ? "default" : status === "paused" ? "secondary" : "outline"}
      >
        {statusLabel}
      </Badge>
    </li>
  );
}

function getPlaybackScheduleMessage(ad: Ad, status: ReturnType<typeof getAdPlaybackStatus>) {
  if (status === "scheduled" && ad.starts_at) {
    return `Inicia em ${formatScheduleDate(ad.starts_at)}.`;
  }

  if (status === "expired" && ad.ends_at) {
    return `Encerrado em ${formatScheduleDate(ad.ends_at)}.`;
  }

  return "Este anúncio não está disponível para exibição agora.";
}

function formatScheduleDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
