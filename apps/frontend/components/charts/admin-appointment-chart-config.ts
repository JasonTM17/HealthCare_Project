import type { ChartConfiguration, Plugin } from "chart.js";
import type { StatusSlice, WeekBucket } from "./adminAppointmentInsights";

/** Stable semantic colors, independent of which statuses occur in the sample. */
export const APPOINTMENT_CHART_COLORS: Record<string, string> = {
  PENDING_CONFIRMATION: "oklch(0.66 0.13 75)",
  CONFIRMED: "oklch(0.48 0.08 185)",
  CHECKED_IN: "oklch(0.55 0.12 245)",
  IN_PROGRESS: "oklch(0.52 0.13 285)",
  COMPLETED: "oklch(0.58 0.12 155)",
  CANCELLED: "oklch(0.56 0.16 25)",
  NO_SHOW: "oklch(0.52 0.01 200)",
};
const TOKENS = {
  ink: "oklch(0.3 0.02 200)", muted: "oklch(0.46 0.02 200)",
  line: "oklch(0.91 0.01 200)", paper: "oklch(1 0 0)",
  bar: APPOINTMENT_CHART_COLORS.CONFIRMED, highlight: "oklch(0.6 0.1 185)",
  gap: 4, fontSize: 12, duration: 200,
};

export function appointmentStatusColor(key: string): string {
  return APPOINTMENT_CHART_COLORS[key] ?? APPOINTMENT_CHART_COLORS.NO_SHOW;
}

export function appointmentShare(count: number, total: number): string {
  return `${(total > 0 ? (count / total) * 100 : 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

export function statusChartConfig(slices: StatusSlice[], animate: boolean, font: string): ChartConfiguration<"doughnut"> {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  return {
    type: "doughnut",
    data: { labels: slices.map((slice) => slice.label), datasets: [{
      data: slices.map((slice) => slice.count), backgroundColor: slices.map((slice) => appointmentStatusColor(slice.key)),
      hoverBackgroundColor: slices.map((slice) => appointmentStatusColor(slice.key)),
      borderColor: TOKENS.paper, borderWidth: TOKENS.gap, borderRadius: TOKENS.gap, hoverOffset: animate ? TOKENS.gap : 0,
    }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "76%", layout: { padding: TOKENS.gap },
      animation: animate ? { duration: TOKENS.duration } : false,
      font: { family: font, size: TOKENS.fontSize },
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: TOKENS.ink, padding: 12, cornerRadius: 4, titleFont: { family: font }, bodyFont: { family: font },
        callbacks: { label: (item) => `${item.label}: ${item.parsed} lịch hẹn (${appointmentShare(item.parsed, total)})` },
      } },
    },
  };
}

export function weekChartConfig(buckets: WeekBucket[], animate: boolean, font: string): ChartConfiguration<"bar"> {
  const peak = Math.max(0, ...buckets.map((bucket) => bucket.count));
  const values: Plugin<"bar"> = {
    id: "appointment-counts",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save(); ctx.fillStyle = TOKENS.ink; ctx.font = `600 ${TOKENS.fontSize}px ${font}`;
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      chart.getDatasetMeta(0).data.forEach((bar, index) => {
        const count = buckets[index]?.count ?? 0;
        if (count > 0) ctx.fillText(String(count), bar.x, bar.y - TOKENS.gap);
      });
      ctx.restore();
    },
  };
  return {
    type: "bar",
    data: { labels: buckets.map((bucket) => {
      const [year, month, day] = bucket.iso.split("-").map(Number);
      const weekday = new Date(year, month - 1, day).getDay();
      return [weekday === 0 ? "CN" : `T${weekday + 1}`, `${day}/${month}`];
    }), datasets: [{ label: "Lịch hẹn", data: buckets.map((bucket) => bucket.count),
      backgroundColor: buckets.map((bucket) => peak > 0 && bucket.count === peak ? TOKENS.highlight : TOKENS.bar),
      hoverBackgroundColor: TOKENS.highlight, borderRadius: TOKENS.gap, maxBarThickness: 40, categoryPercentage: 0.72,
    }] },
    plugins: [values],
    options: {
      responsive: true, maintainAspectRatio: false, animation: animate ? { duration: TOKENS.duration } : false,
      font: { family: font, size: TOKENS.fontSize }, layout: { padding: { top: 20 } },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: TOKENS.ink, padding: 12, cornerRadius: 4,
        titleFont: { family: font }, bodyFont: { family: font }, callbacks: {
          title: (items) => buckets[items[0]?.dataIndex]?.label ?? "",
          label: (item) => `${item.parsed.y} lịch hẹn trong dữ liệu đang xem`,
        } } },
      scales: {
        y: { beginAtZero: true, suggestedMax: peak < 4 ? 4 : undefined, border: { display: false },
          ticks: { precision: 0, maxTicksLimit: 6, color: TOKENS.muted }, grid: { color: TOKENS.line, drawTicks: false } },
        x: { border: { display: false }, ticks: { color: TOKENS.muted, maxRotation: 0, minRotation: 0, autoSkip: false },
          grid: { display: false } },
      },
    },
  };
}
