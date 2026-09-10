"use client";

import { useCallback, useEffect, useState } from "react";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  message: string;
  duration?: number;
}

export function useToastManager() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    ({
      tone,
      title,
      message,
      duration = 4000,
    }: {
      tone: ToastTone;
      title: string;
      message: string;
      duration?: number;
    }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, tone, title, message, duration };
      setToasts((prev) => [...prev.slice(-3), newToast]); // Giữ tối đa 4 thông báo cùng lúc
      return id;
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

function ToastCard({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: (id: string) => void;
}) {
  const { id, tone, title, message, duration = 4000 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const toneConfig = {
    success: {
      border: "border-emerald-300",
      bg: "bg-emerald-50",
      text: "text-emerald-950",
      titleText: "text-emerald-900",
      progress: "bg-emerald-600",
      iconBg: "bg-emerald-100 text-emerald-700",
      icon: (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    error: {
      border: "border-red-300",
      bg: "bg-red-50",
      text: "text-red-950",
      titleText: "text-red-900",
      progress: "bg-red-600",
      iconBg: "bg-red-100 text-red-700",
      icon: (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    warning: {
      border: "border-amber-300",
      bg: "bg-amber-50",
      text: "text-amber-950",
      titleText: "text-amber-900",
      progress: "bg-amber-600",
      iconBg: "bg-amber-100 text-amber-800",
      icon: (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    info: {
      border: "border-teal-300",
      bg: "bg-teal-50",
      text: "text-teal-950",
      titleText: "text-teal-900",
      progress: "bg-teal-600",
      iconBg: "bg-teal-100 text-teal-800",
      icon: (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      ),
    },
  }[tone];

  return (
    <div
      aria-live="polite"
      className={`pointer-events-auto relative overflow-hidden rounded-[4px] border ${toneConfig.border} ${toneConfig.bg} p-3.5 shadow-lg transition-all duration-200 animate-in fade-in slide-in-from-bottom-2`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] ${toneConfig.iconBg}`}
        >
          {toneConfig.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className={`text-sm font-bold leading-5 ${toneConfig.titleText}`}>
            {title}
          </h4>
          <p className={`mt-0.5 text-xs leading-relaxed ${toneConfig.text}`}>
            {message}
          </p>
        </div>
        <button
          aria-label="Đóng thông báo"
          className="shrink-0 rounded-[4px] p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700"
          onClick={() => onClose(id)}
          type="button"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
      </div>
      {/* Animated countdown progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-1 ${toneConfig.progress}`}
        style={{
          width: "100%",
          animation: `toastCountdown ${duration}ms linear forwards`,
        }}
      />
    </div>
  );
}

export function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastItem[];
  onClose: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Thông báo hệ thống"
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex max-w-sm w-full flex-col gap-2.5"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} onClose={onClose} toast={toast} />
      ))}
    </div>
  );
}
