import type { ReactNode } from "react";
import UiIcon, { type IconName } from "../../../components/UiIcon";

type AdminStateTone = "loading" | "error" | "empty" | "forbidden" | "unavailable" | "success" | "info";

const TONE_STYLES: Record<AdminStateTone, { icon: IconName; panel: string; markPanel: string }> = {
  loading: {
    icon: "clock",
    panel: "border-slate-200 bg-white text-slate-700",
    markPanel: "bg-slate-100 text-slate-600",
  },
  error: {
    icon: "alert-triangle",
    panel: "border-red-200 bg-red-50 text-red-900",
    markPanel: "bg-red-100 text-red-700",
  },
  empty: {
    icon: "layers",
    panel: "border-slate-200 bg-white text-slate-700",
    markPanel: "bg-slate-100 text-slate-600",
  },
  forbidden: {
    icon: "shield-check",
    panel: "border-amber-200 bg-amber-50 text-amber-950",
    markPanel: "bg-amber-100 text-amber-800",
  },
  unavailable: {
    icon: "alert-triangle",
    panel: "border-slate-200 bg-slate-50 text-slate-700",
    markPanel: "bg-slate-200 text-slate-700",
  },
  success: {
    icon: "check",
    panel: "border-emerald-200 bg-emerald-50 text-emerald-950",
    markPanel: "bg-emerald-100 text-emerald-800",
  },
  info: {
    icon: "activity",
    panel: "border-teal-200 bg-teal-50 text-teal-950",
    markPanel: "bg-teal-100 text-teal-800",
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
      className={`flex items-start gap-3 rounded-lg border p-4 ${styles.panel}`}
      role={isAlert ? "alert" : tone === "loading" || tone === "success" ? "status" : undefined}
    >
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.markPanel}`}
      >
        <UiIcon className={tone === "loading" ? "admin-state__icon--loading" : undefined} name={styles.icon} size={18} />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-bold" id={titleId}>{title}</h2>
        <p className="mt-1 text-sm leading-6 opacity-80">{description}</p>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
