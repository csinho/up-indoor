import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Clock, LoaderCircle, Pencil, Play, Plus, RefreshCw, Trash2, Tv } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchField, normalizeSearch } from "@/components/list-filters";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
  usePaginatedItems,
} from "@/components/list-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  createAd,
  deleteAd,
  updateAd,
} from "@/lib/data";
import {
  getAdPlaybackStatus,
  getAdPlaybackStatusLabel,
  isAdRunningNow,
  sortAdsForPlayback,
} from "@/lib/ad-utils";
import {
  isInlineMediaSource,
  supabaseEnabled,
  uploadAdMediaDataUri,
  uploadAdMediaFile,
} from "@/lib/supabase";
import type {
  Ad,
  AdInput,
  AdOrientation,
  Company,
  CompanyScreen,
  MediaType,
} from "@/lib/types";

type QueryClient = {
  invalidateQueries: (options: { queryKey: string[] }) => void;
};

type AdStatusFilter = "all" | "live" | "paused" | "scheduled" | "expired";
type AdTypeFilter = "all" | "image" | "video";
type AdOrientationFilter = "all" | AdOrientation;

function getOrientationLabel(orientation: AdOrientation | undefined) {
  switch (orientation) {
    case "landscape":
      return "Horizontal";
    case "portrait":
      return "Vertical";
    default:
      return "Qualquer";
  }
}

function formatScheduleDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getPlaybackScheduleMessage(
  ad: Ad,
  status: ReturnType<typeof getAdPlaybackStatus>,
) {
  if (status === "scheduled" && ad.starts_at) {
    return `Inicia em ${formatScheduleDate(ad.starts_at)}.`;
  }
  if (status === "expired" && ad.ends_at) {
    return `Encerrado em ${formatScheduleDate(ad.ends_at)}.`;
  }
  return "Este anúncio não está disponível para exibição agora.";
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

function AdCard({
  ad,
  linkedTvCount,
  onEdit,
  onDelete,
  onToggle,
  onMigrateInline,
}: {
  ad: Ad;
  linkedTvCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onMigrateInline?: () => void;
}) {
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
        <Badge
          variant="outline"
          className="absolute right-3 top-3 border-white/30 bg-black/40 text-white backdrop-blur"
        >
          {ad.type === "video" ? "Vídeo" : "Imagem"}
        </Badge>
      </div>
      <div className="p-4">
        <h3 className="truncate text-base font-semibold">{ad.title}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Tv className="h-3 w-3" /> {getOrientationLabel(ad.preferred_orientation)}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {ad.duration}s
          </span>
          <span>·</span>
          <span>{linkedTvCount} TV(s)</span>
        </div>
        {status !== "live" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {getPlaybackScheduleMessage(ad, status)}
          </p>
        ) : null}
        <Separator className="my-4" />
        <div className="flex items-center justify-between">
          <Switch checked={ad.active} onCheckedChange={onToggle} />
          <div className="flex gap-1">
            {onMigrateInline ? (
              <Button size="sm" variant="outline" onClick={onMigrateInline}>
                <RefreshCw /> Migrar
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil />
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
  company,
  onSubmit,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
  onSubmit: (values: AdInput) => Promise<void>;
  initial?: Ad;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MediaType>("image");
  const [preferredOrientation, setPreferredOrientation] =
    useState<AdOrientation>("any");
  const [source, setSource] = useState("");
  const [duration, setDuration] = useState(10);
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setType(initial?.type === "video" ? "video" : "image");
    setPreferredOrientation(initial?.preferred_orientation ?? "any");
    setSource(initial?.source ?? "");
    setDuration(initial?.duration ?? 10);
    setActive(initial?.active ?? true);
    setStartsAt(initial?.starts_at?.slice(0, 16) ?? "");
    setEndsAt(initial?.ends_at?.slice(0, 16) ?? "");
    setSelectedFile(null);
    setSubmitting(false);
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
            Anúncio da empresa <strong>{company.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Título</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div>
            <Label>Tipo de mídia</Label>
            <Select value={type} onValueChange={(value) => setType(value as MediaType)}>
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
              onChange={(event) => setDuration(Number(event.target.value))}
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
              onChange={(event) => setSource(event.target.value)}
              placeholder="https://exemplo.com/banner.jpg"
              rows={2}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Ou envie um arquivo</Label>
            <Input
              type="file"
              accept={type === "video" ? "video/*" : "image/*"}
              onChange={(event) => onFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Início (opcional)</Label>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div>
            <Label>Fim (opcional)</Label>
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Este anúncio passa nas TVs onde a empresa está vinculada (aba TVs). Para pausar só
          este anúncio, use o switch abaixo.
        </p>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 p-3">
          <Label className="text-sm">Ativo</Label>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-brand text-brand-foreground"
            disabled={!title.trim() || (!source && !selectedFile) || submitting}
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
                const payload: AdInput = {
                  title,
                  advertiser: company.name,
                  type,
                  source: finalSource,
                  duration,
                  preferred_orientation: preferredOrientation,
                  screen_ids: [],
                  active,
                  starts_at: startsAt ? new Date(startsAt).toISOString() : null,
                  ends_at: endsAt ? new Date(endsAt).toISOString() : null,
                  company_id: company.id,
                };
                await onSubmit(payload);
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? (
              <>
                <LoaderCircle className="animate-spin" /> Enviando
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

export function CompanyAdsSection({
  company,
  ads,
  companyScreens,
  qc,
}: {
  company: Company;
  ads: Ad[];
  companyScreens: CompanyScreen[];
  qc: QueryClient;
}) {
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [deleting, setDeleting] = useState<Ad | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AdTypeFilter>("all");
  const [orientationFilter, setOrientationFilter] =
    useState<AdOrientationFilter>("all");

  const linkedTvCount = useMemo(
    () =>
      companyScreens.filter((link) => link.company_id === company.id).length,
    [company.id, companyScreens],
  );

  const companyAds = useMemo(
    () =>
      sortAdsForPlayback(
        ads.filter(
          (ad) =>
            ad.company_id === company.id &&
            (ad.type === "image" || ad.type === "video"),
        ),
      ),
    [ads, company.id],
  );

  const filteredAds = useMemo(() => {
    const query = normalizeSearch(search);
    return companyAds.filter((ad) => {
      if (typeFilter !== "all" && ad.type !== typeFilter) return false;
      if (
        orientationFilter !== "all" &&
        (ad.preferred_orientation ?? "any") !== orientationFilter
      ) {
        return false;
      }
      const status = getAdPlaybackStatus(ad);
      if (statusFilter === "live" && !isAdRunningNow(ad)) return false;
      if (statusFilter === "paused" && status !== "paused") return false;
      if (statusFilter === "scheduled" && status !== "scheduled") return false;
      if (statusFilter === "expired" && status !== "expired") return false;
      if (!query) return true;
      return ad.title.toLowerCase().includes(query);
    });
  }, [companyAds, orientationFilter, search, statusFilter, typeFilter]);

  const adsPagination = usePaginatedItems(
    filteredAds,
    DEFAULT_PAGE_SIZE,
    `${search}|${statusFilter}|${typeFilter}|${orientationFilter}`,
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
    mutationFn: (ad: Ad) => updateAd(ad.id, { active: !ad.active }),
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
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Anúncios da empresa</h3>
          <p className="text-sm text-muted-foreground">
            {companyAds.length} anúncio(s) · {linkedTvCount} TV(s) vinculada(s) na aba TVs
          </p>
        </div>
        <Button
          onClick={() => setOpenCreate(true)}
          className="gradient-brand text-brand-foreground"
        >
          <Plus /> Novo anúncio
        </Button>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar anúncio..."
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as AdStatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="live">No ar</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="scheduled">Agendados</SelectItem>
            <SelectItem value="expired">Encerrados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as AdTypeFilter)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="video">Vídeo</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={orientationFilter}
          onValueChange={(value) =>
            setOrientationFilter(value as AdOrientationFilter)
          }
        >
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Orientação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas orientações</SelectItem>
            <SelectItem value="any">Qualquer</SelectItem>
            <SelectItem value="landscape">Horizontal</SelectItem>
            <SelectItem value="portrait">Vertical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {linkedTvCount === 0 ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Nenhuma TV vinculada a esta empresa. Vá em TVs, edite a TV desejada e marque esta empresa.
        </div>
      ) : null}

      {filteredAds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum anúncio encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {adsPagination.paginatedItems.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                linkedTvCount={linkedTvCount}
                onEdit={() => setEditing(ad)}
                onDelete={() => setDeleting(ad)}
                onToggle={() => toggleMut.mutate(ad)}
                onMigrateInline={
                  isInlineMediaSource(ad.source)
                    ? () => migrateMut.mutate(ad)
                    : undefined
                }
              />
            ))}
          </div>
          <ListPagination
            page={adsPagination.page}
            totalPages={adsPagination.totalPages}
            totalItems={adsPagination.totalItems}
            rangeStart={adsPagination.rangeStart}
            rangeEnd={adsPagination.rangeEnd}
            onPageChange={adsPagination.setPage}
          />
        </div>
      )}

      <AdFormDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        company={company}
        onSubmit={async (values) => {
          await createAd(values);
          qc.invalidateQueries({ queryKey: ["ads"] });
          toast.success("Anúncio criado");
          setOpenCreate(false);
        }}
      />
      <AdFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        company={company}
        initial={editing ?? undefined}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateAd(editing.id, values);
          qc.invalidateQueries({ queryKey: ["ads"] });
          toast.success("Anúncio atualizado");
          setEditing(null);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este anúncio?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && delMut.mutate(deleting.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
