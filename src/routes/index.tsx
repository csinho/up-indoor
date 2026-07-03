import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Power,
  ExternalLink,
  Sparkles,
  Database,
  Radio,
  Clock,
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
  createScreen,
  updateScreen,
  deleteScreen,
  createAd,
  updateAd,
  deleteAd,
} from "@/lib/data";
import type { Ad, MediaType, Screen } from "@/lib/types";
import { supabaseEnabled } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const screensQ = useQuery({ queryKey: ["screens"], queryFn: listScreens });
  const adsQ = useQuery({ queryKey: ["ads"], queryFn: listAds });

  const screens = screensQ.data ?? [];
  const ads = adsQ.data ?? [];

  const activeScreens = screens.filter((s) => s.active).length;
  const activeAds = ads.filter((a) => a.active).length;

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
            <Overview screens={screens} ads={ads} />
          </TabsContent>

          <TabsContent value="screens">
            <ScreensTab screens={screens} qc={qc} loading={screensQ.isLoading} />
          </TabsContent>

          <TabsContent value="ads">
            <AdsTab ads={ads} screens={screens} qc={qc} loading={adsQ.isLoading} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------- Top bar ----------
function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-glow">
            <Radio className="h-5 w-5 text-brand-foreground" />
          </div>
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
        </div>
      </div>
    </header>
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
            Cadastre telas, publique anúncios com imagem, vídeo ou YouTube e abra
            o player em qualquer TV da sua rede.
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
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <MediaThumb ad={a} className="h-12 w-16 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.advertiser || "Sem anunciante"} · {a.duration}s ·{" "}
                      {a.screen_ids.length} TV(s)
                    </div>
                  </div>
                  <Badge variant={a.active ? "default" : "secondary"}>
                    {a.active ? "Ativo" : "Pausado"}
                  </Badge>
                </li>
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

// ---------- Screens tab ----------
function ScreensTab({
  screens,
  qc,
  loading,
}: {
  screens: Screen[];
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
              onEdit={() => setEditing(s)}
              onDelete={() => setDeleting(s)}
              onToggle={() => toggleMut.mutate(s)}
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
  onEdit,
  onDelete,
  onToggle,
}: {
  screen: Screen;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const playerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/player/${screen.id}`
      : `/player/${screen.id}`;

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
          <p className="mt-1 font-mono text-xs text-muted-foreground/70">
            #{screen.id}
          </p>
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
  onSubmit: (v: { name: string; location: string; active: boolean; id?: string }) => void;
  initial?: Screen;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [id, setId] = useState(initial?.id ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  // reset when opening
  useMemo(() => {
    if (open) {
      setName(initial?.name ?? "");
      setLocation(initial?.location ?? "");
      setId(initial?.id ?? "");
      setActive(initial?.active ?? true);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar TV" : "Nova TV"}</DialogTitle>
          <DialogDescription>
            Configure o nome e local. O ID vira parte do link do player.
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
          {!initial && (
            <div>
              <Label>ID (opcional)</Label>
              <Input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="tv-recepcao"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Deixe em branco para gerar a partir do nome.
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
              onSubmit({ name, location, active, id: id || undefined })
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

  return (
    <div>
      <SectionHeader
        title="Campanhas"
        description="Imagem, vídeo direto ou YouTube — em uma ou várias TVs."
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
      ) : ads.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" />}
          title="Nenhum anúncio criado"
          description="Suba uma imagem, vídeo ou cole um link do YouTube."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ads.map((a) => (
            <AdCard
              key={a.id}
              ad={a}
              screens={screens}
              onEdit={() => setEditing(a)}
              onDelete={() => setDeleting(a)}
              onToggle={() => toggleMut.mutate(a)}
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
}: {
  ad: Ad;
  screens: Screen[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const linked = screens.filter((s) => ad.screen_ids.includes(s.id));
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:border-[color:var(--brand)]/40">
      <div className="relative aspect-video overflow-hidden bg-muted">
        <MediaThumb ad={ad} className="h-full w-full" />
        <Badge
          className="absolute left-3 top-3 backdrop-blur"
          variant={ad.active ? "default" : "secondary"}
        >
          {ad.active ? "No ar" : "Pausado"}
        </Badge>
        <Badge variant="outline" className="absolute right-3 top-3 border-white/30 bg-black/40 text-white backdrop-blur">
          {ad.type === "youtube" ? "YouTube" : ad.type === "video" ? "Vídeo" : "Imagem"}
        </Badge>
      </div>
      <div className="p-4">
        <h3 className="truncate text-base font-semibold">{ad.title}</h3>
        <p className="truncate text-xs text-muted-foreground">
          {ad.advertiser || "Sem anunciante"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {ad.duration}s
          </span>
          <span>·</span>
          <span>{linked.length} TV(s)</span>
        </div>
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
  onSubmit: (v: Omit<Ad, "id" | "created_at">) => void;
  initial?: Ad;
}) {
  const [title, setTitle] = useState("");
  const [advertiser, setAdvertiser] = useState("");
  const [type, setType] = useState<MediaType>("image");
  const [source, setSource] = useState("");
  const [duration, setDuration] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useMemo(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setAdvertiser(initial?.advertiser ?? "");
      setType(initial?.type ?? "image");
      setSource(initial?.source ?? "");
      setDuration(initial?.duration ?? 10);
      setSelected(initial?.screen_ids ?? []);
      setActive(initial?.active ?? true);
      setStartsAt(initial?.starts_at?.slice(0, 16) ?? "");
      setEndsAt(initial?.ends_at?.slice(0, 16) ?? "");
    }
  }, [open, initial]);

  const onFile = async (file: File | null) => {
    if (!file) return;
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
                <SelectItem value="youtube">YouTube</SelectItem>
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
          <div className="md:col-span-2">
            <Label>
              {type === "youtube" ? "URL do YouTube" : "URL da mídia"}
            </Label>
            <Textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={
                type === "youtube"
                  ? "https://youtu.be/..."
                  : "https://exemplo.com/banner.jpg"
              }
              rows={2}
            />
          </div>
          {type !== "youtube" && (
            <div className="md:col-span-2">
              <Label>Ou envie um arquivo</Label>
              <Input
                type="file"
                accept={type === "video" ? "video/*" : "image/*"}
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
          <div>
            <Label>Início (opcional)</Label>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <Label>Fim (opcional)</Label>
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
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
            disabled={!title || !source}
            onClick={() =>
              onSubmit({
                title,
                advertiser,
                type,
                source,
                duration,
                screen_ids: selected,
                active,
                starts_at: startsAt ? new Date(startsAt).toISOString() : null,
                ends_at: endsAt ? new Date(endsAt).toISOString() : null,
              })
            }
          >
            {initial ? "Salvar" : "Criar anúncio"}
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
  if (ad.type === "youtube") {
    const id = extractYouTubeId(ad.source);
    const thumb = id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
    return thumb ? (
      <img src={thumb} alt={ad.title} className={`object-cover ${className}`} />
    ) : (
      <div className={`grid place-items-center bg-muted text-muted-foreground ${className}`}>
        <ExternalLink className="h-6 w-6" />
      </div>
    );
  }
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

export function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  return m ? m[1] : null;
}
