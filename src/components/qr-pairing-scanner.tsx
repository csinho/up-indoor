import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Html5QrcodeInstance = {
  start: (
    cameraIdOrConfig: { facingMode: string },
    configuration: {
      fps: number;
      qrbox: { width: number; height: number };
      aspectRatio: number;
    },
    qrCodeSuccessCallback: (decoded: string) => void,
    qrCodeErrorCallback: () => void,
  ) => Promise<null>;
  stop: () => Promise<void>;
  clear: () => void;
};

type QrPairingScannerProps = {
  onScan: (payload: string) => void;
  onClose?: () => void;
  disabled?: boolean;
};

function waitForElement(id: string, attempts = 12) {
  return new Promise<HTMLElement | null>((resolve) => {
    let remaining = attempts;

    const check = () => {
      const element = document.getElementById(id);
      if (element) {
        resolve(element);
        return;
      }

      remaining -= 1;
      if (remaining <= 0) {
        resolve(null);
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

function getInsecureContextMessage() {
  const host =
    typeof window !== "undefined" ? window.location.hostname : "SEU_IP";
  return `A câmera só funciona em HTTPS ou localhost. No celular, use https://${host}:8080 após rodar "npm run dev:lan:https" no PC.`;
}

function getScannerErrorMessage(error: unknown) {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return getInsecureContextMessage();
  }

  if (typeof error === "string") {
    if (error.toLowerCase().includes("camera streaming not supported")) {
      return getInsecureContextMessage();
    }
    return error;
  }

  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("camera streaming not supported")) {
      return getInsecureContextMessage();
    }
    return error.message;
  }

  return "Não foi possível acessar a câmera.";
}

export function QrPairingScanner({ onScan, onClose, disabled = false }: QrPairingScannerProps) {
  const elementIdRef = useRef(`qr-scanner-${Math.random().toString(36).slice(2, 10)}`);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const onScanRef = useRef(onScan);
  const scanLockedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [manualPayload, setManualPayload] = useState("");
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;

    await scanner.stop().catch(() => undefined);
    try {
      scanner.clear();
    } catch {
      // ignore cleanup errors
    }
  };

  const handleDecoded = (decoded: string) => {
    if (scanLockedRef.current || disabled) return;

    scanLockedRef.current = true;
    setScannedPayload(decoded);
    void stopScanner();
    onScanRef.current(decoded);
  };

  useLayoutEffect(() => {
    let disposed = false;

    const boot = async () => {
      if (disabled || scanLockedRef.current) return;

      if (!window.isSecureContext) {
        setStarting(false);
        setError(getInsecureContextMessage());
        return;
      }

      const element = await waitForElement(elementIdRef.current);
      if (disposed) return;

      if (!element) {
        setStarting(false);
        setError("Não foi possível iniciar o scanner. Tente novamente ou use o código manual.");
        return;
      }

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (disposed) return;

        const scanner = new Html5Qrcode(elementIdRef.current) as Html5QrcodeInstance;
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1,
          },
          (decoded) => {
            handleDecoded(decoded);
          },
          () => undefined,
        );

        if (!disposed) setStarting(false);
      } catch (startError) {
        if (!disposed) {
          setStarting(false);
          setError(getScannerErrorMessage(startError));
        }
      }
    };

    void boot();

    return () => {
      disposed = true;
      void stopScanner();
    };
  }, [disabled]);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
        <div
          ref={containerRef}
          id={elementIdRef.current}
          className="min-h-[280px] w-full"
        />
        {starting ? (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <LoaderCircle className="h-8 w-8 animate-spin text-white" />
          </div>
        ) : null}
        {scannedPayload ? (
          <div className="absolute inset-0 grid place-items-center bg-black/70 px-6 text-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-white" />
            <p className="mt-3 text-sm text-white">Pareando TV...</p>
          </div>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        {scannedPayload
          ? "QR lido. Aguarde a confirmação do pareamento."
          : "Aponte a câmera para o QR exibido na TV. O pareamento acontece em poucos segundos."}
      </p>

      {error ? (
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <div className="space-y-2">
            <Label htmlFor="manual-qr-payload" className="text-xs text-muted-foreground">
              Alternativa: cole o conteúdo do QR (JSON)
            </Label>
            <Input
              id="manual-qr-payload"
              value={manualPayload}
              onChange={(event) => setManualPayload(event.target.value)}
              placeholder='{"v":1,"d":"ABC123","t":"...","api":"..."}'
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!manualPayload.trim() || disabled}
              onClick={() => {
                if (scanLockedRef.current || disabled) return;
                handleDecoded(manualPayload.trim());
              }}
            >
              Parear com código manual
            </Button>
          </div>
        </div>
      ) : null}

      {onClose ? (
        <Button type="button" variant="outline" onClick={onClose} className="w-full">
          Cancelar
        </Button>
      ) : null}
    </div>
  );
}
