import { useCallback, useEffect, useMemo, useState } from "react";

const DISMISS_KEY = "up-indoor-pwa-install-dismissed";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isMobileDevice() {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(max-width: 767px)").matches;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });

  useEffect(() => {
    if (isStandaloneMode()) return;

    const onBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (choice.outcome === "accepted") {
      setDismissed(true);
      window.localStorage.setItem(DISMISS_KEY, "1");
      return true;
    }

    return false;
  }, [deferredPrompt]);

  const state = useMemo(() => {
    const installed = isStandaloneMode();
    const ios = isIosDevice();
    const mobile = isMobileDevice();
    const canInstall = Boolean(deferredPrompt);
    const showManualIos = ios && !installed;
    const showManualMobile = mobile && !installed && !canInstall;
    const showPrompt = !installed && !dismissed && (canInstall || showManualIos || showManualMobile);

    return {
      installed,
      ios,
      mobile,
      canInstall,
      showManualIos,
      showManualMobile,
      showPrompt,
      dismissed,
    };
  }, [deferredPrompt, dismissed]);

  return {
    ...state,
    dismiss,
    install,
  };
}
