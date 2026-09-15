"use client";

import { useEffect, useRef, useState } from "react";
import {
  Chart,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  LinearScale,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from "chart.js";
import { adminListAppointments } from "../../lib/api-client";
import type { AppointmentDetails } from "../../types/hospital";
import {
  summarizeStatuses,
  summarizeUpcomingDays,
  type StatusSlice,
  type WeekBucket,
} from "./adminAppointmentInsights";

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, LinearScale, Tooltip, Legend);

const STATUS_COLORS = ["#0f766e", "#14b8a6", "#0ea5e9", "#f59e0b", "#059669", "#94a3b8", "#f43f5e"];

type LoadState =
  | { status: "loading" }
  | { status: "ready"; slices: StatusSlice[]; week: WeekBucket[]; total: number }
  | { status: "error"; message: string };

function buildStatusConfig(slices: StatusSlice[], animate: boolean): ChartConfiguration {
  return {
    type: "doughnut",
    data: {
      labels: slices.map((slice) => slice.label),
      datasets: [{
        data: slices.map((slice) => slice.count),
        backgroundColor: slices.map((_, index) => STATUS_COLORS[index % STATUS_COLORS.length]),
        borderWidth: 1,
        borderColor: "#ffffff",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animate ? undefined : false,
      plugins: { legend: { position: "right", labels: { color: "#1e293b", font: { size: 12 } } } },
    },
  };
}

function buildWeekConfig(buckets: WeekBucket[], animate: boolean): ChartConfiguration {
  return {
    type: "bar",
    data: {
      labels: buckets.map((bucket) => bucket.label),
      datasets: [{
        label: "Lịch hẹn",
        data: buckets.map((bucket) => bucket.count),
        backgroundColor: "#0f766e",
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animate ? undefined : false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, color: "#475569" }, grid: { color: "#e2e8f0" } },
        x: { ticks: { color: "#475569" }, grid: { display: false } },
      },
    },
  };
}

/**
 * Admin dashboard insights: appointment status split and the upcoming-week
 * volume, rendered with Chart.js from the live admin appointments API.
 */
export default function AdminAppointmentsChart() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const statusCanvasRef = useRef<HTMLCanvasElement>(null);
  const weekCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      try {
        const page = await adminListAppointments({ page: 0, size: 100 });
        if (cancelled) return;
        setState({
          status: "ready",
          slices: summarizeStatuses(page.content),
          week: summarizeUpcomingDays(page.content, new Date()),
          total: page.totalElements,
        });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Chưa thể tải dữ liệu biểu tượng lịch hẹn. Vui lòng thử lại sau." });
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (state.status !== "ready") return;
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A chart failure must degrade to the inline error message, never take the
    // whole admin dashboard into the route error boundary.
    try {
      const charts: Chart[] = [];
      if (statusCanvasRef.current) {
        charts.push(new Chart(statusCanvasRef.current, buildStatusConfig(state.slices, !reducedMotion)));
      }
      if (weekCanvasRef.current) {
        charts.push(new Chart(weekCanvasRef.current, buildWeekConfig(state.week, !reducedMotion)));
      }
      return () => {
        cancelled = true;
        for (const chart of charts) chart.destroy();
      };
    } catch {
      void Promise.resolve().then(() => {
        if (!cancelled) setState({ status: "error", message: "Không thể vẽ biểu đồ lịch hẹn trên trình duyệt hiện tại." });
      });
    }
  }, [state]);

  if (state.status === "error") {
    return (
      <p className="border-b border-slate-200 bg-white p-6 text-sm font-semibold text-red-700" role="alert">
        {state.message}
      </p>
    );
  }

  if (state.status === "loading") {
    return (
      <p className="border-b border-slate-200 bg-white p-6 text-sm text-slate-500" role="status">
        Đang tổng hợp dữ liệu lịch hẹn…
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 border-b border-slate-200 bg-white p-6 xl:grid-cols-2">
      <section aria-labelledby="admin-chart-status-title">
        <h3 className="text-base font-bold text-slate-900" id="admin-chart-status-title">Lịch hẹn theo trạng thái</h3>
        <p className="mt-1 text-xs text-slate-500">
          Phạm vi dữ liệu: {state.slices.reduce((sum, slice) => sum + slice.count, 0)}/{state.total} lịch hẹn trong trang dữ liệu hiện tại.
        </p>
        <div className="relative mt-4 h-64">
          <canvas aria-label={`Phân bố ${state.total} lịch hẹn theo trạng thái`} ref={statusCanvasRef} role="img" />
        </div>
        <table className="sr-only">
          <caption>Phân bố lịch hẹn theo trạng thái</caption>
          <thead><tr><th scope="col">Trạng thái</th><th scope="col">Số lượng</th></tr></thead>
          <tbody>
            {state.slices.map((slice) => (
              <tr key={slice.key}><th scope="row">{slice.label}</th><td>{slice.count}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="admin-chart-week-title">
        <h3 className="text-base font-bold text-slate-900" id="admin-chart-week-title">Lịch hẹn 7 ngày tới</h3>
        <div className="relative mt-4 h-64">
          <canvas aria-label="Số lịch hẹn trong 7 ngày tới" ref={weekCanvasRef} role="img" />
        </div>
        <table className="sr-only">
          <caption>Số lịch hẹn trong 7 ngày tới</caption>
          <thead><tr><th scope="col">Ngày</th><th scope="col">Số lượng</th></tr></thead>
          <tbody>
            {state.week.map((bucket) => (
              <tr key={bucket.iso}><th scope="row">{bucket.label}</th><td>{bucket.count}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
