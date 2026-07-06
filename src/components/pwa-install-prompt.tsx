import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Download, Share, Smartphone, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePwaInstall } from "@/hooks/use-pwa-install";

export function PwaInstallBanner() {
  const {
    installed,
    ios,
    canInstall,
    showManualIos,
    showManualMobile,
    showPrompt,
    install,
    dismiss,
  } = usePwaInstall();
  const [dialogOpen, setDialogOpen] = useState(false);
  const isDashboard = useRouterState({
    select: (state) => state.location.pathname === "/",
  });

  if (installed || !showPrompt) {
    return null;
  }

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) {
      toast.success("App instalado com sucesso.");
    }
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 z-30 border-t border-border/70 bg-card/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur md:bottom-4 md:z-40 md:max-w-sm md:rounded-2xl md:border md:left-auto md:right-4",
          isDashboard
            ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
            : "bottom-0",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Instale o Up Indoor</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canInstall
                ? "Adicione o painel à tela inicial para abrir como app."
                : ios
                  ? "No Safari: Compartilhar → Adicionar à Tela de Início."
                  : "No menu do navegador, escolha Instalar app ou Adicionar à tela inicial."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {canInstall ? (
                <Button size="sm" className="gradient-brand text-brand-foreground" onClick={handleInstall}>
                  <Download className="h-4 w-4" />
                  Instalar agora
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                Ver passo a passo
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Agora não
              </Button>
            </div>
          </div>
          <Button size="icon" variant="ghost" className="shrink-0" onClick={dismiss} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <PwaInstallDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

export function PwaInstallButton({ className }: { className?: string }) {
  const { installed } = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (installed) return null;

  return (
    <>
      <Button size="sm" variant="outline" className={className} onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Instalar app</span>
        <span className="sm:hidden">Instalar</span>
      </Button>
      <PwaInstallDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function PwaInstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    installed,
    ios,
    canInstall,
    showManualIos,
    showManualMobile,
    install,
    dismiss,
  } = usePwaInstall();

  if (installed) return null;

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) {
      toast.success("App instalado com sucesso.");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Instalar Up Indoor
          </DialogTitle>
          <DialogDescription>
            Use o painel como app na tela inicial do celular para parear TVs e gerenciar campanhas
            com mais rapidez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm text-muted-foreground">
          {canInstall ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="font-medium text-foreground">Instalação rápida</p>
              <p className="mt-1">
                Toque em instalar e confirme no navegador. O app ficará disponível na tela inicial.
              </p>
              <Button className="mt-4 w-full gradient-brand text-brand-foreground" onClick={handleInstall}>
                <Download className="h-4 w-4" />
                Instalar app
              </Button>
            </div>
          ) : null}

          {showManualIos ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="font-medium text-foreground">No iPhone (Safari)</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Toque no botão Compartilhar</li>
                <li>Escolha Adicionar à Tela de Início</li>
                <li>Confirme em Adicionar</li>
              </ol>
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-foreground">
                <Share className="h-4 w-4" />
                Compartilhar → Tela de Início
              </div>
            </div>
          ) : null}

          {showManualMobile && !ios ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="font-medium text-foreground">No Android / Chrome</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Abra o menu do navegador (⋮)</li>
                <li>Escolha Instalar app ou Adicionar à tela inicial</li>
                <li>Confirme a instalação</li>
              </ol>
            </div>
          ) : null}

          {!canInstall && !showManualIos && !showManualMobile ? (
            <p>
              Se o botão de instalação não aparecer, use o menu do navegador para adicionar este site à
              tela inicial.
            </p>
          ) : null}
        </div>

        <Button
          variant="outline"
          onClick={() => {
            dismiss();
            onOpenChange(false);
          }}
        >
          Não mostrar novamente
        </Button>
      </DialogContent>
    </Dialog>
  );
}
