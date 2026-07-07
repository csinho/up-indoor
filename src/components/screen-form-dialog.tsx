import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  Company,
  CompanyScreen,
  LayoutTemplate,
  Orientation,
  Screen,
  ScreenDisplayMode,
  ScreenInput,
  Store,
} from "@/lib/types";

const DISPLAY_MODE_OPTIONS: Array<{
  value: ScreenDisplayMode;
  label: string;
}> = [
  { value: "normal", label: "Normal" },
  { value: "rotate_90", label: "Vertical 90" },
  { value: "rotate_270", label: "Vertical 270" },
  { value: "fill", label: "Tela cheia" },
];

function getDisplayModeLabel(mode: ScreenDisplayMode) {
  return DISPLAY_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

function getDisplayModeTransform(
  mode: ScreenDisplayMode,
  orientation: Orientation,
): string {
  switch (mode) {
    case "rotate_90":
      return "rotate(90deg)";
    case "rotate_270":
      return "rotate(-90deg)";
    case "fill":
      return "scale(1.08)";
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

export function ScreenFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initial,
  stores,
  companies,
  companyScreens,
  layouts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ScreenInput, companyIds: string[]) => void | Promise<void>;
  initial?: Screen;
  stores: Store[];
  companies: Company[];
  companyScreens: CompanyScreen[];
  layouts: LayoutTemplate[];
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [storeId, setStoreId] = useState(
    initial?.store_id ?? stores[0]?.id ?? "",
  );
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
  const [layoutTemplateId, setLayoutTemplateId] = useState<string | null>(
    initial?.layout_template_id ?? null,
  );
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setLocation(initial?.location ?? "");
    setStoreId(initial?.store_id ?? stores[0]?.id ?? "");
    setId(initial?.id ?? "");
    setActive(initial?.active ?? true);
    setOrientation(initial?.orientation ?? "landscape");
    setDisplayMode(initial?.display_mode ?? "normal");
    setResolutionWidth(initial?.resolution_width ?? 1920);
    setResolutionHeight(initial?.resolution_height ?? 1080);
    setLayoutTemplateId(initial?.layout_template_id ?? null);
    setSelectedCompanyIds(
      initial
        ? companyScreens
            .filter((link) => link.screen_id === initial.id)
            .map((link) => link.company_id)
        : [],
    );
  }, [open, initial, stores, companyScreens]);

  useEffect(() => {
    if (!layoutTemplateId) return;
    const selected = layouts.find((layout) => layout.id === layoutTemplateId);
    if (selected && selected.orientation !== orientation) {
      setLayoutTemplateId(null);
    }
  }, [orientation, layoutTemplateId, layouts]);

  const canSubmit = Boolean(name.trim() && storeId);
  const activeCompanies = companies.filter((company) => company.active);
  const compatibleLayouts = layouts.filter(
    (layout) => layout.orientation === orientation,
  );

  const toggleCompany = (companyId: string, checked: boolean) => {
    setSelectedCompanyIds((current) =>
      checked
        ? [...current, companyId]
        : current.filter((entry) => entry !== companyId),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar TV" : "Nova TV"}</DialogTitle>
          <DialogDescription>
            Vincule o ponto físico e as empresas cujos anúncios devem passar nesta TV.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="TV Recepção"
                />
              </div>
              <div>
                <Label>Local</Label>
                <Input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Academia — Recepção"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Ponto *</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um ponto" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            {initial ? (
              <div>
                <Label>Screen ID</Label>
                <Input value={initial.id} readOnly />
              </div>
            ) : (
              <div>
                <Label>Screen ID (opcional)</Label>
                <Input
                  value={id}
                  onChange={(event) => setId(event.target.value)}
                  placeholder="tv-recepcao"
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Resolução largura</Label>
                <Input
                  type="number"
                  min={1}
                  value={resolutionWidth}
                  onChange={(event) => setResolutionWidth(Number(event.target.value))}
                />
              </div>
              <div>
                <Label>Resolução altura</Label>
                <Input
                  type="number"
                  min={1}
                  value={resolutionHeight}
                  onChange={(event) => setResolutionHeight(Number(event.target.value))}
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Modo de exibição</Label>
              <DisplayModeButtons value={displayMode} onChange={setDisplayMode} />
            </div>

            <div>
              <Label>Layout (opcional)</Label>
              <Select
                value={layoutTemplateId ?? "none"}
                onValueChange={(value) =>
                  setLayoutTemplateId(value === "none" ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tela cheia (padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tela cheia (padrão)</SelectItem>
                  {compatibleLayouts.map((layout) => (
                    <SelectItem key={layout.id} value={layout.id}>
                      {layout.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {layouts.length > 0 && compatibleLayouts.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nenhum layout compatível com orientação{" "}
                  {orientation === "portrait" ? "vertical" : "horizontal"}.
                </p>
              ) : null}
            </div>

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

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Preview</Label>
              <ScreenDisplayPreview
                orientation={orientation}
                displayMode={displayMode}
                className="h-36 w-full rounded-xl"
              />
            </div>

            <div>
              <Label className="mb-1 block">Empresas nesta TV</Label>
              <p className="mb-3 text-xs text-muted-foreground">
                Ao marcar uma empresa, todos os anúncios ativos dela passam nesta TV.
                Para pausar só um anúncio, use o switch na lista da empresa.
              </p>
              {activeCompanies.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  Cadastre empresas na aba Empresas.
                </p>
              ) : (
                <div className="grid max-h-52 gap-2 overflow-y-auto rounded-lg border border-border/60 p-3 sm:grid-cols-2">
                  {activeCompanies.map((company) => (
                    <label
                      key={company.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
                    >
                      <Checkbox
                        checked={selectedCompanyIds.includes(company.id)}
                        onCheckedChange={(checked) =>
                          toggleCompany(company.id, checked === true)
                        }
                      />
                      <span className="truncate text-sm">{company.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-brand text-brand-foreground"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit(
                {
                  name,
                  location,
                  active,
                  orientation,
                  display_mode: displayMode,
                  resolution_width: resolutionWidth,
                  resolution_height: resolutionHeight,
                  layout_template_id: layoutTemplateId,
                  store_id: storeId,
                  id: id || undefined,
                },
                selectedCompanyIds,
              )
            }
          >
            {initial ? "Salvar" : "Criar TV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
