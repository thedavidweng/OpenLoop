import {
  useEffect,
  useState,
  useCallback,
  createContext,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

// Time given for the exit animation to play before a toast is unmounted. Kept in
// sync with --motion-duration-standard so the visual and the timer agree.
const TOAST_EXIT_MS = 220;

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
  leaving?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (
    type: ToastType,
    message: string,
    options?: { duration?: number; action?: ToastAction },
  ) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    // Already animating out — leave the in-flight exit timer alone.
    if (exitTimersRef.current.has(id)) return;
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    const exit = setTimeout(() => {
      exitTimersRef.current.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_EXIT_MS);
    exitTimersRef.current.set(id, exit);
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, options?: { duration?: number; action?: ToastAction }) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [
        ...prev,
        {
          id,
          type,
          message,
          duration: options?.duration,
          action: options?.action,
        },
      ]);
      const timer = setTimeout(() => removeToast(id), options?.duration ?? 3000);
      timersRef.current.set(id, timer);
      return id;
    },
    [removeToast],
  );

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      for (const timer of exitTimersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICON_MAP = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const TONE_MAP = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  info: "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
} as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICON_MAP[toast.type];

  return (
    <div
      data-state={toast.leaving ? "closed" : "open"}
      className={`pointer-events-auto ${toast.leaving ? "animate-fade-out" : "animate-slide-in-right"} flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] font-medium shadow-[var(--shadow-popover)] backdrop-blur-xl ${TONE_MAP[toast.type]}`}
    >
      <Icon size={14} className="shrink-0" />
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onDismiss();
          }}
          className="shrink-0 rounded-md border border-current/30 px-2 py-0.5 text-[11px] font-semibold hover:bg-white/10 transition-colors"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={12} />
      </button>
    </div>
  );
}
