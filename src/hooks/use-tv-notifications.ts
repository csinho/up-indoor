import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  listInAppNotifications,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
  syncMyTvHealthNotifications,
} from "@/lib/data";
import type { InAppNotification } from "@/lib/types";

const NOTIFICATIONS_QUERY_KEY = ["inAppNotifications"] as const;

function toastForNotification(notification: InAppNotification) {
  if (notification.type === "tv_problem") {
    toast.error(notification.title, {
      description: notification.body,
      duration: 8000,
    });
    return;
  }

  toast.success(notification.title, {
    description: notification.body,
    duration: 6000,
  });
}

export function useTvNotifications(enabled: boolean) {
  const qc = useQueryClient();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const notificationsQ = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: listInAppNotifications,
    enabled,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!enabled) return;

    const sync = () => {
      void syncMyTvHealthNotifications()
        .then(() => qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }))
        .catch((error) => {
          console.error("syncMyTvHealthNotifications failed", error);
        });
    };

    sync();
    const timer = window.setInterval(sync, 30_000);
    return () => window.clearInterval(timer);
  }, [enabled, qc]);

  useEffect(() => {
    const notifications = notificationsQ.data;
    if (!notifications) return;

    if (!initializedRef.current) {
      for (const notification of notifications) {
        seenIdsRef.current.add(notification.id);
      }
      initializedRef.current = true;
      return;
    }

    for (const notification of notifications) {
      if (seenIdsRef.current.has(notification.id)) continue;
      seenIdsRef.current.add(notification.id);
      if (!notification.read_at) {
        toastForNotification(notification);
      }
    }
  }, [notificationsQ.data]);

  const markReadM = useMutation({
    mutationFn: markInAppNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  const markAllReadM = useMutation({
    mutationFn: markAllInAppNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  const notifications = notificationsQ.data ?? [];
  const unreadCount = notifications.filter((entry) => !entry.read_at).length;

  return {
    notifications,
    unreadCount,
    isLoading: notificationsQ.isLoading,
    markRead: markReadM.mutate,
    markAllRead: markAllReadM.mutate,
  };
}
