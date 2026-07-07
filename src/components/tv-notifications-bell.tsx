import { Bell, CheckCheck, LoaderCircle, Tv } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTvNotifications } from "@/hooks/use-tv-notifications";
import { cn } from "@/lib/utils";

function formatNotificationTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TvNotificationsBell({ enabled }: { enabled: boolean }) {
  const {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
  } = useTvNotifications(enabled);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          aria-label="Notificações das TVs"
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notificações das TVs</span>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => markAllRead()}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Marcar todas
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação por enquanto.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 whitespace-normal p-3",
                  !notification.read_at && "bg-muted/50",
                )}
                onSelect={(event) => {
                  event.preventDefault();
                  if (!notification.read_at) {
                    markRead(notification.id);
                  }
                }}
              >
                <div
                  className={cn(
                    "mt-0.5 rounded-md p-1.5",
                    notification.type === "tv_problem"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-success/10 text-success",
                  )}
                >
                  <Tv className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">
                      {notification.title}
                    </p>
                    {!notification.read_at ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-primary/30 bg-primary/10 text-[10px] text-primary"
                      >
                        Nova
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {notification.body}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    {formatNotificationTime(notification.created_at)}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
