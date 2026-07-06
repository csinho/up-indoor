import { useRegisterSW } from "virtual:pwa-register/react";

import { PwaInstallBanner } from "@/components/pwa-install-prompt";

export function PwaManager() {
  useRegisterSW({
    immediate: true,
  });

  return <PwaInstallBanner />;
}
