import {
  Building2,
  LayoutDashboard,
  Store,
  Tv,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type DashboardTab =
  | "overview"
  | "stores"
  | "screens"
  | "companies";

const NAV_ITEMS: Array<{
  value: DashboardTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { value: "overview", label: "Início", icon: LayoutDashboard },
  { value: "stores", label: "Pontos", icon: Store },
  { value: "screens", label: "TVs", icon: Tv },
  { value: "companies", label: "Empresas", icon: Building2 },
];

export function MobileBottomNav({
  value,
  onChange,
}: {
  value: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center justify-between gap-1 rounded-full border border-border/70 bg-card/95 px-2 py-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur-md">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = value === item.value;

          return (
            <button
              key={item.value}
              type="button"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(item.value)}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition",
                active
                  ? "gradient-brand text-brand-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
