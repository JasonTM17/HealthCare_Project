import type { ReactNode } from "react";

type AdminStateTone = "loading" | "error" | "empty" | "forbidden" | "unavailable" | "success";

const TONE_STYLES: Record<AdminStateTone, { mark: string; panel: string; markPanel: string }> = {
  loading: {
    mark: "…",
    panel: "border-slate-200 bg-white text-slate-700",
    markPanel: "bg-slate-100 text-slate-600",
  },
  error: {
    mark: "!",
    panel: "border-red-200 bg-red-50 text-red-900",
    markPanel: "bg-red-100 text-red-700",
  },
  empty: {
    mark: "—",
    panel: "border-slate-200 bg-white text-slate-700",
    markPanel: "bg-slate-100 text-slate-600",
  },
  forbidden: {
    mark: "!",
    panel: "border-amber-200 bg-amber-50 text-amber-950",
    markPanel: "bg-amber-100 text-amber-800",
  },
  unavailable: {
    mark: "i",
    panel: "border-slate-200 bg-slate-50 text-slate-700",
    markPanel: "bg-slate-200 text-slate-700",
  },
  success: {
    mark: "✓",
    panel: "border-emerald-200 bg-emerald-50 text-emerald-950",
    markPanel: "bg-emerald-100 text-emerald-800",
  },
};

export default function AdminState({
  tone,
  title,
  description,
  action,
  titleId,
}: {
  tone: AdminStateTone;
  title: string;
  description: string;
  action?: ReactNode;
  titleId?: string;
}) {
  const styles = TONE_STYLES[tone];
  const isAlert = tone === "error" || tone === "forbidden";

  return (
    <div
      aria-live={isAlert ? "assertive" : "polite"}
      className={`flex items-start gap-3 rounded-2xl border p-5 ${styles.panel}`}
      role={isAlert ? "alert" : tone === "loading" ? "status" : undefined}
    >
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${styles.markPanel}`}
      >
        {styles.mark}
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-bold" id={titleId}>{title}</h2>
        <p className="mt-1 text-sm leading-6 opacity-80">{description}</p>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
