import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  ChevronLeft,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  Store as StoreIcon,
  Trash2,
  Tv,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  createCompany,
  createStore,
  deleteCompany,
  deleteStore,
  updateCompany,
  updateStore,
} from "@/lib/data";
import {
  AdSearchResults,
  CompanyAdsSection,
  searchAdsAcrossCompanies,
} from "@/components/company-ads";
import { SearchField, normalizeSearch } from "@/components/list-filters";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
  usePaginatedItems,
} from "@/components/list-pagination";
import type {
  BillingStatus,
  Category,
  Company,
  CompanyInput,
  CompanyScreen,
  Ad,
  Screen,
  Store,
  StoreInput,
} from "@/lib/types";

type QueryClient = {
  invalidateQueries: (options: { queryKey: string[] }) => void;
};

function getBillingBadge(status: BillingStatus) {
  switch (status) {
    case "active":
      return { label: "Em dia", className: "border-success/40 bg-success/10 text-success" };
    case "overdue":
      return { label: "Atrasado", className: "border-warning/40 bg-warning/10 text-warning" };
    case "suspended":
      return { label: "Suspenso", className: "border-destructive/40 bg-destructive/10 text-destructive" };
  }
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PointsTab({
  stores,
  categories,
  screens,
  qc,
  loading,
}: {
  stores: Store[];
  categories: Category[];
  screens: Screen[];
  qc: QueryClient;
  loading: boolean;
}) {
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const screensByStore = useMemo(() => {
    const map = new Map<string, Screen[]>();
    for (const screen of screens) {
      if (!screen.store_id) continue;
      const current = map.get(screen.store_id) ?? [];
      current.push(screen);
      map.set(screen.store_id, current);
    }
    return map;
  }, [screens]);

  const categoryName = (id: string | null) =>
    categories.find((category) => category.id === id)?.name ?? "Sem categoria";

  const filteredStores = useMemo(() => {
    const query = normalizeSearch(search);
    return stores.filter((store) => {
      if (categoryFilter !== "all" && store.category_id !== categoryFilter) return false;
      if (!query) return true;
      const haystack = [store.name, store.city, store.address, categoryName(store.category_id)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [categoryFilter, categories, search, stores]);

  const storesPagination = usePaginatedItems(
    filteredStores,
    DEFAULT_PAGE_SIZE,
    `${search}|${categoryFilter}`,
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pontos</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre locais físicos e vincule TVs a cada ponto.
          </p>
        </div>
        <Button
          onClick={() => setOpenCreate(true)}
          className="gradient-brand text-brand-foreground shadow-glow"
        >
          <Plus /> Novo ponto
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar ponto, cidade ou endereço..."
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando pontos...</p>
      ) : stores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <StoreIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum ponto cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie o primeiro ponto antes de cadastrar TVs.
          </p>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum ponto encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {storesPagination.paginatedItems.map((store) => {
            const linkedScreens = screensByStore.get(store.id) ?? [];
            return (
              <div
                key={store.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{store.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {store.city || "Cidade não informada"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{categoryName(store.category_id)}</Badge>
                      <Badge variant={store.active ? "default" : "secondary"}>
                        {store.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    {store.address ? (
                      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {store.address}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {linkedScreens.length} TV(s) vinculada(s)
                    </p>
                    {linkedScreens.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {linkedScreens.map((screen) => (
                          <Badge key={screen.id} variant="secondary" className="text-xs">
                            <Tv className="mr-1 h-3 w-3" />
                            {screen.name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(store)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        try {
                          await deleteStore(store.id);
                          qc.invalidateQueries({ queryKey: ["stores"] });
                          toast.success("Ponto excluído");
                        } catch (error) {
                          toast.error((error as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          <ListPagination
            page={storesPagination.page}
            totalPages={storesPagination.totalPages}
            totalItems={storesPagination.totalItems}
            rangeStart={storesPagination.rangeStart}
            rangeEnd={storesPagination.rangeEnd}
            onPageChange={storesPagination.setPage}
          />
        </div>
      )}

      <StoreFormDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        categories={categories}
        onSubmit={async (values) => {
          await createStore(values);
          qc.invalidateQueries({ queryKey: ["stores"] });
          toast.success("Ponto criado");
          setOpenCreate(false);
        }}
      />
      <StoreFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        categories={categories}
        initial={editing ?? undefined}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateStore(editing.id, values);
          qc.invalidateQueries({ queryKey: ["stores"] });
          toast.success("Ponto atualizado");
          setEditing(null);
        }}
      />
    </div>
  );
}

function StoreFormDialog({
  open,
  onOpenChange,
  categories,
  onSubmit,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSubmit: (values: StoreInput) => Promise<void>;
  initial?: Store;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setAddress(initial?.address ?? "");
    setCity(initial?.city ?? "");
    setCategoryId(initial?.category_id ?? "none");
    setNotes(initial?.notes ?? "");
    setActive(initial?.active ?? true);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar ponto" : "Novo ponto"}</DialogTitle>
          <DialogDescription>
            Informe os dados do ponto físico e a categoria de segmento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length === 0 ? (
              <p className="mt-1 text-xs text-warning">
                Categorias indisponíveis. Recarregue a página em alguns segundos.
              </p>
            ) : null}
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <Label>Ponto ativo</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-brand text-brand-foreground"
            disabled={submitting || !name.trim()}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit({
                  name,
                  address,
                  city,
                  category_id: categoryId === "none" ? null : categoryId,
                  notes,
                  active,
                });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CompaniesTab({
  companies,
  categories,
  screens,
  companyScreens,
  ads,
  qc,
  loading,
  billingFilter,
  onBillingFilterChange,
}: {
  companies: Company[];
  categories: Category[];
  screens: Screen[];
  companyScreens: CompanyScreen[];
  ads: Ad[];
  qc: QueryClient;
  loading: boolean;
  billingFilter: "all" | BillingStatus;
  onBillingFilterChange: (value: "all" | BillingStatus) => void;
}) {
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [viewingTvs, setViewingTvs] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [focusAdId, setFocusAdId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const screensByCompany = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of companyScreens) {
      const current = map.get(link.company_id) ?? [];
      current.push(link.screen_id);
      map.set(link.company_id, current);
    }
    return map;
  }, [companyScreens]);

  const categoryLabel = (id: string | null) =>
    categories.find((category) => category.id === id)?.name ?? "Sem categoria";

  const adsCountByCompany = useMemo(() => {
    const map = new Map<string, number>();
    for (const ad of ads) {
      if (!ad.company_id || (ad.type !== "image" && ad.type !== "video")) continue;
      map.set(ad.company_id, (map.get(ad.company_id) ?? 0) + 1);
    }
    return map;
  }, [ads]);

  const matchingAds = useMemo(
    () => searchAdsAcrossCompanies(ads, companies, categories, search),
    [ads, companies, categories, search],
  );

  const companyIdsWithMatchingAds = useMemo(() => {
    return new Set(
      matchingAds
        .map((ad) => ad.company_id)
        .filter((companyId): companyId is string => Boolean(companyId)),
    );
  }, [matchingAds]);

  const filteredCompanies = useMemo(() => {
    const query = normalizeSearch(search);
    return companies.filter((company) => {
      if (billingFilter !== "all" && company.billing_status !== billingFilter) {
        return false;
      }
      if (categoryFilter !== "all" && company.category_id !== categoryFilter) {
        return false;
      }
      if (!query) return true;
      if (companyIdsWithMatchingAds.has(company.id)) return true;
      const haystack = [
        company.name,
        company.contact_name,
        company.contact_email,
        categoryLabel(company.category_id),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [
    billingFilter,
    categoryFilter,
    companies,
    companyIdsWithMatchingAds,
    search,
    categories,
  ]);

  const companiesPagination = usePaginatedItems(
    filteredCompanies,
    DEFAULT_PAGE_SIZE,
    `${search}|${categoryFilter}|${billingFilter}`,
  );

  if (selectedCompany) {
    const billing = getBillingBadge(selectedCompany.billing_status);
    const linkedScreenIds = screensByCompany.get(selectedCompany.id) ?? [];
    const linkedScreens = screens.filter((screen) =>
      linkedScreenIds.includes(screen.id),
    );

    return (
      <div>
        <Button
          variant="ghost"
          className="mb-4 -ml-2 gap-2"
          onClick={() => setSelectedCompany(null)}
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para empresas
        </Button>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold">{selectedCompany.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedCompany.contact_name || "Sem contato"}
                {selectedCompany.contact_email
                  ? ` · ${selectedCompany.contact_email}`
                  : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{categoryLabel(selectedCompany.category_id)}</Badge>
                <Badge className={billing.className}>{billing.label}</Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {formatCurrency(selectedCompany.monthly_amount_cents)} / mês · venc. dia{" "}
                {selectedCompany.payment_due_day} · {linkedScreens.length} TV(s) vinculada(s)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setViewingTvs(selectedCompany)}>
                <Tv className="h-4 w-4" /> TVs
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(selectedCompany)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </div>
          </div>

          <CompanyAdsSection
            company={selectedCompany}
            companies={companies}
            categories={categories}
            ads={ads}
            companyScreens={companyScreens}
            qc={qc}
            focusAdId={focusAdId}
            onFocusAdHandled={() => setFocusAdId(null)}
          />
        </div>

        <CompanyFormDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          categories={categories}
          initial={editing ?? undefined}
          onSubmit={async (values) => {
            if (!editing) return;
            await updateCompany(editing.id, values);
            qc.invalidateQueries({ queryKey: ["companies"] });
            qc.invalidateQueries({ queryKey: ["ads"] });
            setSelectedCompany((current) =>
              current?.id === editing.id ? { ...current, ...values } : current,
            );
            toast.success("Empresa atualizada");
            setEditing(null);
          }}
        />

        <CompanyTvsReadOnlyDialog
          company={viewingTvs}
          screens={screens}
          companyScreens={companyScreens}
          onOpenChange={(open) => !open && setViewingTvs(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Empresas</h2>
          <p className="text-sm text-muted-foreground">
            Anunciantes, campanhas, cobrança e targeting por categoria.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={billingFilter}
            onValueChange={(value) =>
              onBillingFilterChange(value as "all" | BillingStatus)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="active">Em dia</SelectItem>
              <SelectItem value="overdue">Inadimplentes</SelectItem>
              <SelectItem value="suspended">Suspensas</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => setOpenCreate(true)}
            className="gradient-brand text-brand-foreground shadow-glow"
          >
            <Plus /> Nova empresa
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar anúncio, código, empresa ou categoria..."
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AdSearchResults
        ads={matchingAds}
        companies={companies}
        onSelect={(ad) => {
          const target = companies.find((company) => company.id === ad.company_id);
          if (!target) {
            toast.error("Empresa deste anúncio não foi encontrada.");
            return;
          }
          setFocusAdId(ad.id);
          setSelectedCompany(target);
        }}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando empresas...</p>
      ) : filteredCompanies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhuma empresa encontrada</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {companiesPagination.paginatedItems.map((company) => {
            const billing = getBillingBadge(company.billing_status);
            const linkedScreenIds = screensByCompany.get(company.id) ?? [];
            const linkedScreens = screens.filter((screen) =>
              linkedScreenIds.includes(screen.id),
            );

            return (
              <div
                key={company.id}
                className="cursor-pointer rounded-2xl border border-border bg-card p-5 shadow-card transition hover:border-[color:var(--brand)]/40"
                onClick={() => setSelectedCompany(company)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{company.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {company.contact_name || "Sem contato"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{categoryLabel(company.category_id)}</Badge>
                      <Badge className={billing.className}>{billing.label}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {formatCurrency(company.monthly_amount_cents)} / mês · venc. dia{" "}
                      {company.payment_due_day}
                    </p>
                    {company.contact_email ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {company.contact_email}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {linkedScreens.length} TV(s) exibindo anúncios ·{" "}
                      {adsCountByCompany.get(company.id) ?? 0} anúncio(s)
                    </p>
                  </div>
                  <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Ver anúncios"
                      onClick={() => setSelectedCompany(company)}
                    >
                      <Megaphone className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Ver TVs vinculadas"
                      onClick={() => setViewingTvs(company)}
                    >
                      <Tv className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(company)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        try {
                          await deleteCompany(company.id);
                          qc.invalidateQueries({ queryKey: ["companies"] });
                          qc.invalidateQueries({ queryKey: ["companyScreens"] });
                          toast.success("Empresa excluída");
                        } catch (error) {
                          toast.error((error as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          <ListPagination
            page={companiesPagination.page}
            totalPages={companiesPagination.totalPages}
            totalItems={companiesPagination.totalItems}
            rangeStart={companiesPagination.rangeStart}
            rangeEnd={companiesPagination.rangeEnd}
            onPageChange={companiesPagination.setPage}
          />
        </div>
      )}

      <CompanyFormDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        categories={categories}
        onSubmit={async (values) => {
          await createCompany(values);
          qc.invalidateQueries({ queryKey: ["companies"] });
          toast.success("Empresa criada");
          setOpenCreate(false);
        }}
      />
      <CompanyFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        categories={categories}
        initial={editing ?? undefined}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateCompany(editing.id, values);
          qc.invalidateQueries({ queryKey: ["companies"] });
          qc.invalidateQueries({ queryKey: ["ads"] });
          toast.success("Empresa atualizada");
          setEditing(null);
        }}
      />

      <CompanyTvsReadOnlyDialog
        company={viewingTvs}
        screens={screens}
        companyScreens={companyScreens}
        onOpenChange={(open) => !open && setViewingTvs(null)}
      />
    </div>
  );
}

function CompanyTvsReadOnlyDialog({
  company,
  screens,
  companyScreens,
  onOpenChange,
}: {
  company: Company | null;
  screens: Screen[];
  companyScreens: CompanyScreen[];
  onOpenChange: (open: boolean) => void;
}) {
  const linkedScreens = useMemo(() => {
    if (!company) return [] as Screen[];
    const ids = companyScreens
      .filter((link) => link.company_id === company.id)
      .map((link) => link.screen_id);
    return screens.filter((screen) => ids.includes(screen.id));
  }, [company, companyScreens, screens]);

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>TVs com anúncios desta empresa</DialogTitle>
          <DialogDescription>
            Visualização somente leitura. Para vincular ou desvincular empresas, edite a TV na aba TVs.
          </DialogDescription>
        </DialogHeader>
        {linkedScreens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma TV vinculada ainda. Abra a TV desejada em TVs e marque esta empresa.
          </p>
        ) : (
          <ul className="grid max-h-80 gap-2 overflow-y-auto">
            {linkedScreens.map((screen) => (
              <li
                key={screen.id}
                className="rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                {screen.name}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompanyFormDialog({
  open,
  onOpenChange,
  categories,
  onSubmit,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSubmit: (values: CompanyInput) => Promise<void>;
  initial?: Company;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [billingStatus, setBillingStatus] = useState<BillingStatus>("active");
  const [monthlyAmount, setMonthlyAmount] = useState("0");
  const [paymentDueDay, setPaymentDueDay] = useState("10");
  const [lastPaymentAt, setLastPaymentAt] = useState("");
  const [nextPaymentAt, setNextPaymentAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCategoryId(initial?.category_id ?? "none");
    setContactName(initial?.contact_name ?? "");
    setContactEmail(initial?.contact_email ?? "");
    setContactPhone(initial?.contact_phone ?? "");
    setNotes(initial?.notes ?? "");
    setActive(initial?.active ?? true);
    setBillingStatus(initial?.billing_status ?? "active");
    setMonthlyAmount(String((initial?.monthly_amount_cents ?? 0) / 100));
    setPaymentDueDay(String(initial?.payment_due_day ?? 10));
    setLastPaymentAt(initial?.last_payment_at?.slice(0, 10) ?? "");
    setNextPaymentAt(initial?.next_payment_at?.slice(0, 10) ?? "");
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          <DialogDescription>
            Dados do anunciante e status de cobrança manual.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length === 0 ? (
              <p className="mt-1 text-xs text-warning">
                Categorias indisponíveis. Recarregue a página em alguns segundos.
              </p>
            ) : null}
          </div>
          <div>
            <Label>Status de cobrança</Label>
            <Select
              value={billingStatus}
              onValueChange={(value) => setBillingStatus(value as BillingStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Em dia</SelectItem>
                <SelectItem value="overdue">Atrasado</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor mensal (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>Dia de vencimento</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={paymentDueDay}
              onChange={(e) => setPaymentDueDay(e.target.value)}
            />
          </div>
          <div>
            <Label>Último pagamento</Label>
            <Input
              type="date"
              value={lastPaymentAt}
              onChange={(e) => setLastPaymentAt(e.target.value)}
            />
          </div>
          <div>
            <Label>Próximo pagamento</Label>
            <Input
              type="date"
              value={nextPaymentAt}
              onChange={(e) => setNextPaymentAt(e.target.value)}
            />
          </div>
          <div>
            <Label>Contato</Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 p-3">
          <Label>Empresa ativa</Label>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-brand text-brand-foreground"
            disabled={submitting || !name.trim()}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit({
                  name,
                  category_id: categoryId === "none" ? null : categoryId,
                  contact_name: contactName,
                  contact_email: contactEmail,
                  contact_phone: contactPhone,
                  notes,
                  active,
                  billing_status: billingStatus,
                  monthly_amount_cents: Math.round(Number(monthlyAmount || 0) * 100),
                  payment_due_day: Math.min(28, Math.max(1, Number(paymentDueDay) || 10)),
                  last_payment_at: lastPaymentAt ? `${lastPaymentAt}T12:00:00.000Z` : null,
                  next_payment_at: nextPaymentAt ? `${nextPaymentAt}T12:00:00.000Z` : null,
                });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use PointsTab */
export const StoresTab = PointsTab;
