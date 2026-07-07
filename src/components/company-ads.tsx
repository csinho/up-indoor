import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Clock,
  Copy,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Tv,
} from "lucide-react";
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
import { normalizeAdPublicCode } from "@/lib/ad-public-code";
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
import { normalizeVideoForTv, getVideoUploadErrorMessage } from "@/lib/video-tv-normalize";
import type {
  Ad,
  AdInput,
  AdOrientation,
  Category,
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

function getAdPreviewSource(ad: Ad) {
  if (!ad.source || isInlineMediaSource(ad.source)) return null;
  return ad.source;
}

function adMatchesQuery(
  ad: Ad,
  query: string,
  companyName?: string,
  categoryName?: string,
) {
  if (!query) return true;
  const haystack = [
    ad.title,
    ad.public_code,
    ad.advertiser,
    companyName,
    categoryName,
    ad.id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function AdMediaPreview({
  type,
  previewUrl,
  className,
}: {
  type: MediaType;
  previewUrl: string;
  className?: string;
}) {
  if (!previewUrl) return null;

  if (type === "video") {
    return (
      <video
        src={previewUrl}
        className={className}
        controls
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <img src={previewUrl} alt="Prévia da mídia" className={className} />
  );
}

function MediaThumb({ ad, className }: { ad: Ad; className?: string }) {
  const previewSource = getAdPreviewSource(ad);

  if (ad.type === "video") {
    return previewSource ? (
      <video
        src={previewSource}
        className={`object-cover ${className}`}
        muted
        playsInline
        preload="metadata"
      />
    ) : (
      <div className={`grid place-items-center bg-muted text-muted-foreground ${className}`}>
        <Play className="h-6 w-6" />
      </div>
    );
  }

  return previewSource ? (
    <img src={previewSource} alt={ad.title} className={`object-cover ${className}`} />
  ) : (
    <div className={`bg-muted ${className}`} />
  );
}

async function copyAdCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  } catch {
    toast.error("Não foi possível copiar o código");
  }
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
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground transition hover:text-foreground"
          onClick={() => copyAdCode(ad.public_code)}
          title="Copiar código do anúncio"
        >
          {ad.public_code}
          <Copy className="h-3 w-3" />
        </button>
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
  companies,
  defaultCompanyId,
  onSubmit,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  defaultCompanyId: string;
  onSubmit: (values: AdInput) => Promise<void>;
  initial?: Ad;
}) {
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MediaType>("image");
  const [preferredOrientation, setPreferredOrientation] =
    useState<AdOrientation>("any");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pendingInlineUpload, setPendingInlineUpload] = useState<string | null>(
    null,
  );
  const [duration, setDuration] = useState(10);
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const selectedCompany = companies.find((company) => company.id === companyId);

  const revokeBlobPreview = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) return;

    setCompanyId(initial?.company_id ?? defaultCompanyId);
    setTitle(initial?.title ?? "");
    setType(initial?.type === "video" ? "video" : "image");
    setPreferredOrientation(initial?.preferred_orientation ?? "any");
    setDuration(initial?.duration ?? 10);
    setActive(initial?.active ?? true);
    setStartsAt(initial?.starts_at?.slice(0, 16) ?? "");
    setEndsAt(initial?.ends_at?.slice(0, 16) ?? "");
    setUploadFile(null);
    setSubmitting(false);
    revokeBlobPreview();

    if (initial?.source && isInlineMediaSource(initial.source)) {
      setPendingInlineUpload(initial.source);
      setRemoteUrl("");
      setPreviewUrl(initial.source);
      return;
    }

    setPendingInlineUpload(null);
    const existingUrl = initial?.source && !isInlineMediaSource(initial.source)
      ? initial.source
      : "";
    setRemoteUrl(existingUrl);
    setPreviewUrl(existingUrl);
  }, [open, initial, defaultCompanyId]);

  useEffect(() => {
    return () => revokeBlobPreview();
  }, []);

  const onFile = (file: File | null) => {
    if (!file) return;
    revokeBlobPreview();
    const objectUrl = URL.createObjectURL(file);
    blobUrlRef.current = objectUrl;
    setUploadFile(file);
    setPendingInlineUpload(null);
    setRemoteUrl("");
    setPreviewUrl(objectUrl);
    if (file.type.startsWith("video")) setType("video");
    else if (file.type.startsWith("image")) setType("image");
  };

  const onRemoteUrlChange = (value: string) => {
    setRemoteUrl(value);
    setUploadFile(null);
    setPendingInlineUpload(null);
    revokeBlobPreview();
    const trimmed = value.trim();
    setPreviewUrl(trimmed);
  };

  const hasMedia =
    Boolean(uploadFile) ||
    Boolean(pendingInlineUpload) ||
    Boolean(remoteUrl.trim()) ||
    Boolean(previewUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar anúncio" : "Novo anúncio"}</DialogTitle>
          <DialogDescription>
            {initial ? (
              <>
                Código <strong className="font-mono">{initial.public_code}</strong>
                {selectedCompany ? (
                  <>
                    {" "}
                    · empresa <strong>{selectedCompany.name}</strong>
                  </>
                ) : null}
              </>
            ) : (
              <>Crie um anúncio e vincule à empresa desejada.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Label>URL da mídia (opcional)</Label>
            <Input
              value={remoteUrl}
              onChange={(event) => onRemoteUrlChange(event.target.value)}
              placeholder="https://exemplo.com/banner.jpg"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Cole uma URL pública ou envie um arquivo abaixo. O conteúdo enviado
              fica no Storage após salvar.
            </p>
          </div>
          <div className="md:col-span-2">
            <Label>Ou envie um arquivo</Label>
            <Input
              type="file"
              accept={type === "video" ? "video/*" : "image/*"}
              onChange={(event) => onFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {hasMedia ? (
            <div className="md:col-span-2 overflow-hidden rounded-xl border border-border bg-muted/30">
              <AdMediaPreview
                type={type}
                previewUrl={previewUrl}
                className="max-h-56 w-full object-contain"
              />
            </div>
          ) : null}
          {remoteUrl && !isInlineMediaSource(remoteUrl) ? (
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">URL salva</Label>
              <p className="truncate rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {remoteUrl}
              </p>
            </div>
          ) : null}
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
          Este anúncio passa nas TVs onde a empresa está vinculada (aba TVs).
          Vídeos do celular ou WhatsApp são convertidos automaticamente para o
          formato compatível com Fire Stick e Android TV.
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
            disabled={!title.trim() || !hasMedia || !companyId || submitting}
            onClick={async () => {
              if (!selectedCompany) {
                toast.error("Selecione uma empresa.");
                return;
              }

              try {
                setSubmitting(true);
                let finalSource = remoteUrl.trim();

                if (supabaseEnabled) {
                  if (uploadFile) {
                    const preparedFile =
                      type === "video"
                        ? await normalizeVideoForTv(uploadFile, (message) =>
                            toast.message(message),
                          )
                        : uploadFile;
                    finalSource = await uploadAdMediaFile(preparedFile);
                  } else if (
                    pendingInlineUpload &&
                    isInlineMediaSource(pendingInlineUpload)
                  ) {
                    const extension = type === "video" ? "mp4" : "png";
                    finalSource = await uploadAdMediaDataUri(
                      pendingInlineUpload,
                      `${title || "anuncio"}.${extension}`,
                    );
                  }
                }

                if (!finalSource && initial?.source) {
                  finalSource = initial.source;
                }

                if (!finalSource) {
                  throw new Error("Informe uma mídia para o anúncio.");
                }

                if (isInlineMediaSource(finalSource)) {
                  throw new Error(
                    "A mídia ainda não foi enviada ao Storage. Selecione o arquivo novamente ou aguarde o upload.",
                  );
                }

                const payload: AdInput = {
                  title: title.trim(),
                  advertiser: selectedCompany.name,
                  type,
                  source: finalSource,
                  duration,
                  preferred_orientation: preferredOrientation,
                  screen_ids: initial?.screen_ids ?? [],
                  active,
                  starts_at: startsAt ? new Date(startsAt).toISOString() : null,
                  ends_at: endsAt ? new Date(endsAt).toISOString() : null,
                  company_id: companyId,
                };
                await onSubmit(payload);
              } catch (error) {
                toast.error(getVideoUploadErrorMessage(error));
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
  companies,
  categories,
  ads,
  companyScreens,
  qc,
  focusAdId,
  onFocusAdHandled,
}: {
  company: Company;
  companies: Company[];
  categories: Category[];
  ads: Ad[];
  companyScreens: CompanyScreen[];
  qc: QueryClient;
  focusAdId?: string | null;
  onFocusAdHandled?: () => void;
}) {
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [deleting, setDeleting] = useState<Ad | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AdTypeFilter>("all");
  const [orientationFilter, setOrientationFilter] =
    useState<AdOrientationFilter>("all");

  const categoryLabel = (id: string | null) =>
    categories.find((category) => category.id === id)?.name ?? "";

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

  useEffect(() => {
    if (!focusAdId) return;
    const ad = companyAds.find((entry) => entry.id === focusAdId);
    if (ad) {
      setEditing(ad);
      onFocusAdHandled?.();
    }
  }, [companyAds, focusAdId, onFocusAdHandled]);

  const filteredAds = useMemo(() => {
    const query = normalizeSearch(search);
    const companyCategory = categoryLabel(company.category_id);
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
      return adMatchesQuery(ad, query, company.name, companyCategory);
    });
  }, [
    company.category_id,
    company.name,
    companyAds,
    categoryLabel,
    orientationFilter,
    search,
    statusFilter,
    typeFilter,
  ]);

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
          placeholder="Buscar por título, código ou empresa..."
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
        companies={companies}
        defaultCompanyId={company.id}
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
        companies={companies}
        defaultCompanyId={company.id}
        initial={editing ?? undefined}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateAd(editing.id, {
            title: values.title,
            advertiser: values.advertiser,
            type: values.type,
            source: values.source,
            duration: values.duration,
            preferred_orientation: values.preferred_orientation,
            active: values.active,
            starts_at: values.starts_at,
            ends_at: values.ends_at,
            company_id: values.company_id,
          });
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

export function searchAdsAcrossCompanies(
  ads: Ad[],
  companies: Company[],
  categories: Category[],
  search: string,
) {
  const query = normalizeSearch(search);
  if (!query) return [];

  const companyById = new Map(companies.map((company) => [company.id, company]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return sortAdsForPlayback(
    ads.filter((ad) => {
      if (ad.type !== "image" && ad.type !== "video") return false;
      const linkedCompany = ad.company_id
        ? companyById.get(ad.company_id)
        : undefined;
      const categoryName = linkedCompany?.category_id
        ? categoryById.get(linkedCompany.category_id)?.name
        : undefined;
      return adMatchesQuery(
        ad,
        query,
        linkedCompany?.name,
        categoryName,
      );
    }),
  );
}

export function AdSearchResults({
  ads,
  companies,
  onSelect,
}: {
  ads: Ad[];
  companies: Company[];
  onSelect: (ad: Ad) => void;
}) {
  if (ads.length === 0) return null;

  const companyById = new Map(companies.map((company) => [company.id, company]));

  return (
    <div className="mb-6 space-y-3 rounded-2xl border border-[color:var(--brand)]/30 bg-card p-4 shadow-card">
      <div>
        <h3 className="text-sm font-semibold">Anúncios encontrados</h3>
        <p className="text-xs text-muted-foreground">
          {ads.length} resultado(s) por título, código, empresa ou categoria
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ads.slice(0, 9).map((ad) => {
          const linkedCompany = ad.company_id
            ? companyById.get(ad.company_id)
            : undefined;
          return (
            <button
              key={ad.id}
              type="button"
              className="overflow-hidden rounded-xl border border-border text-left transition hover:border-[color:var(--brand)]/40"
              onClick={() => onSelect(ad)}
            >
              <div className="aspect-video bg-muted">
                <MediaThumb ad={ad} className="h-full w-full" />
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate text-sm font-medium">{ad.title}</p>
                <p className="font-mono text-xs text-muted-foreground">{ad.public_code}</p>
                <p className="text-xs text-muted-foreground">
                  {linkedCompany?.name ?? "Sem empresa"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function matchesAdPublicCodeQuery(search: string, ad: Ad) {
  const query = normalizeAdPublicCode(search);
  if (!query) return false;
  return normalizeAdPublicCode(ad.public_code).includes(query);
}
