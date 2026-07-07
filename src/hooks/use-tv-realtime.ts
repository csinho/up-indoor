import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { syncMyTvHealthNotifications } from "@/lib/data";

const NOTIFICATIONS_QUERY_KEY = ["inAppNotifications"] as const;
const TV_DEVICES_QUERY_KEY = ["tvDevices"] as const;

export function useTvRealtime(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || !supabase) return;

    const channel = supabase
      .channel("tv-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tv_devices" },
        () => {
          qc.invalidateQueries({ queryKey: TV_DEVICES_QUERY_KEY });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "in_app_notifications" },
        () => {
          qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "in_app_notifications" },
        () => {
          qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tv_screen_health_snapshots" },
        () => {
          qc.invalidateQueries({ queryKey: TV_DEVICES_QUERY_KEY });
          qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
        },
      )
      .subscribe();

    return () => {
      if (supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, qc]);

  useEffect(() => {
    if (!enabled) return;

    const sync = () => {
      void syncMyTvHealthNotifications().catch((error) => {
        console.error("syncMyTvHealthNotifications failed", error);
      });
    };

    sync();
    const timer = window.setInterval(sync, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
}
