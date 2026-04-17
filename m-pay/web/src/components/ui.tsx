import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ─── Toast Manager ───────────────────────────────────────────────────

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: ToastKind };

let toastId = 0;
let addToastFn: ((message: string, kind: ToastKind) => void) | null = null;

export function showToast(message: string, kind: ToastKind = "info") {
  addToastFn?.(message, kind);
}

const TOAST_CLASSES: Record<ToastKind, string> = {
  success: "bg-emerald-500/90 text-emerald-950 shadow-emerald-500/30",
  error: "bg-error-container text-on-error-container shadow-error/30",
  info: "bg-primary text-on-primary shadow-primary-container/30",
};

const TOAST_ICONS: Record<ToastKind, string> = {
  success: "check_circle",
  error: "error",
  info: "info",
};

// ─── Confirm Dialog ─────────────────────────────────────────────────

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmRequest = ConfirmOptions & { resolve: (v: boolean) => void };

let confirmFn: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  if (!confirmFn) {
    // Provider not mounted — safer to default to deny than to crash.
    return Promise.resolve(false);
  }
  return confirmFn(opts);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  const show = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setReq({ ...opts, resolve });
    });
  }, []);

  useEffect(() => {
    confirmFn = show;
    return () => { confirmFn = null; };
  }, [show]);

  const close = useCallback((result: boolean) => {
    setReq((cur) => {
      cur?.resolve(result);
      return null;
    });
  }, []);

  return (
    <>
      {children}
      {req && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[toast-in_0.15s_ease-out]"
          onClick={() => close(false)}
        >
          <div
            className="bg-surface-container-low rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl border border-outline-variant/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <h3 className="text-xl font-headline font-bold text-on-surface">{req.title}</h3>
              {req.message && <p className="text-sm text-on-surface-variant leading-relaxed">{req.message}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => close(false)}
                className="flex-1 py-3 rounded-xl font-headline font-bold border border-outline-variant/30 text-on-surface hover:bg-surface-container-highest transition-all"
              >
                {req.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 py-3 rounded-xl font-headline font-bold transition-all ${
                  req.destructive
                    ? "bg-error/15 text-error border border-error/30 hover:bg-error/25"
                    : "gradient-btn text-on-primary hover:brightness-110"
                }`}
              >
                {req.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, kind: ToastKind) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, kind }]);
    const ttl = kind === "error" ? 5000 : 2500;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  return (
    <>
      {children}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none max-w-md">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 font-label text-sm px-4 py-2.5 rounded-xl shadow-lg animate-[toast-in_0.2s_ease-out] ${TOAST_CLASSES[t.kind]}`}
          >
            <Icon name={TOAST_ICONS[t.kind]} filled className="text-base shrink-0" />
            <span className="break-words">{t.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── UI Components ───────────────────────────────────────────────────

export type TxStage = "idle" | "proving" | "wallet" | "submitting";

const STAGE_STEPS: { key: Exclude<TxStage, "idle">; label: string }[] = [
  { key: "proving", label: "Generating proof" },
  { key: "wallet", label: "Wallet (unlock + sign)" },
  { key: "submitting", label: "Submitting" },
];

export function Spinner({ message, stage }: { message: string; stage?: TxStage }) {
  const activeIdx = stage && stage !== "idle"
    ? STAGE_STEPS.findIndex((s) => s.key === stage)
    : -1;

  return (
    <div className="bg-surface-container rounded-2xl p-6 mt-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-5 h-5 border-2 border-outline-variant border-t-primary rounded-full animate-spin shrink-0" />
        <span className="text-on-surface-variant font-body text-sm">{message}</span>
      </div>
      {activeIdx >= 0 && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            {STAGE_STEPS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
                  i < activeIdx
                    ? "bg-primary"
                    : i === activeIdx
                      ? "bg-primary animate-pulse"
                      : "bg-surface-container-highest"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            {STAGE_STEPS.map((s, i) => (
              <span
                key={s.key}
                className={`flex-1 text-[10px] font-label uppercase tracking-wider text-center ${
                  i === activeIdx
                    ? "text-primary font-bold"
                    : i < activeIdx
                      ? "text-on-surface-variant"
                      : "text-outline/50"
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Icon({
  name,
  filled,
  className,
}: {
  name: string;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        showToast("Copied!");
      }}
      className="text-outline hover:text-primary transition-colors shrink-0"
    >
      <Icon name="content_copy" className="text-sm" />
    </button>
  );
}
