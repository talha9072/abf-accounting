"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "./icon";

type ToastInput = { message: ReactNode; actionLabel?: string; onAction?: () => void };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { ...t, id }]);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex w-[min(460px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext>
  );
}

function ToastView({ toast, onDone }: { toast: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div
      role="status"
      className="pointer-events-auto flex animate-toast-in items-center gap-3 rounded-xl bg-ink px-4 py-3.5 text-white shadow-[0_16px_40px_rgb(10_31_59/0.16)]"
    >
      <span className="text-brand">
        <Icon icon={faCircleCheck} size={16} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] font-medium leading-[18px]">{toast.message}</p>
      {toast.actionLabel ? (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.();
            onDone();
          }}
          className="rounded px-1 text-[13px] font-bold leading-[18px] text-white hover:text-brand-bright"
        >
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
