"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
interface Toast { id: number; message: string; type: ToastType }
interface ToastCtx { toast: (message: string, type?: ToastType) => void }

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let counter = 0;

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counter;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const colors = {
    success: { bg: "#111", border: "#00C896", icon: "#00C896", Ico: CheckCircle },
    error:   { bg: "#111", border: "#FF4545", icon: "#FF4545", Ico: XCircle    },
    info:    { bg: "#111", border: "#C9A84C", icon: "#C9A84C", Ico: AlertCircle },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "10px", maxWidth: "360px" }}>
        {toasts.map((t) => {
          const c = colors[t.type];
          return (
            <div key={t.id}
              style={{
                background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: "12px", padding: "14px 16px",
                display: "flex", alignItems: "center", gap: "12px",
                boxShadow: `0 0 20px ${c.border}25`,
                animation: "slide-up 0.3s ease-out",
              }}
            >
              <c.Ico size={18} color={c.icon} style={{ flexShrink: 0 }} />
              <span style={{ color: "#E8E8E8", fontSize: "14px", flex: 1, lineHeight: 1.4 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#5C5C5C", display: "flex", padding: "2px" }}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
