"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Chart, ArcElement, BarController, BarElement, CategoryScale, DoughnutController, LinearScale, Tooltip, Legend } from "chart.js";
import { adminListAppointments } from "../../lib/api-client";
import { summarizeStatuses, summarizeUpcomingDays, type StatusSlice, type WeekBucket } from "./adminAppointmentInsights";
import { appointmentCount, appointmentShare, appointmentStatusColor, statusChartConfig, weekChartConfig } from "./admin-appointment-chart-config";

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, LinearScale, Tooltip, Legend);

type LoadState =
  | { status: "loading" }
  | { status: "ready"; slices: StatusSlice[]; week: WeekBucket[]; total: number }
  | { status: "error" };

/** Chart.js presentation of the authorized first page; never claims aggregate coverage. */
export default function AdminAppointmentsChart() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [chartUnavailable, setChartUnavailable] = useState(false);
  const statusCanvasRef = useRef<HTMLCanvasElement>(null);
  const weekCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setState({ status: "loading" });
      setChartUnavailable(false);
      try {
        const page = await adminListAppointments({ page: 0, size: 100 });
        if (!cancelled) setState({ status: "ready", slices: summarizeStatuses(page.content),
          week: summarizeUpcomingDays(page.content, new Date()), total: page.totalElements });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    if (state.status !== "ready" || state.slices.length === 0) return;
    let cancelled = false;
    const charts: Chart[] = [];
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      if (statusCanvasRef.current) {
        const font = getComputedStyle(statusCanvasRef.current).fontFamily;
        const chart = new Chart(statusCanvasRef.current, statusChartConfig(state.slices, animate, font));
        charts.push(chart);
        if (!chart.ctx) throw new Error("Canvas unavailable");
      }
      if (weekCanvasRef.current) {
        const font = getComputedStyle(weekCanvasRef.current).fontFamily;
        const chart = new Chart(weekCanvasRef.current, weekChartConfig(state.week, animate, font));
        charts.push(chart);
        if (!chart.ctx) throw new Error("Canvas unavailable");
      }
    } catch {
      // Dispose partial construction; keep data usable when canvas drawing fails.
      for (const canvas of [statusCanvasRef.current, weekCanvasRef.current]) {
        const partial = canvas ? Chart.getChart(canvas) : undefined;
        if (partial && !charts.includes(partial)) charts.push(partial);
      }
      for (const chart of charts) chart.destroy();
      charts.length = 0;
      void Promise.resolve().then(() => { if (!cancelled) setChartUnavailable(true); });
    }
    return () => {
      cancelled = true;
      for (const chart of charts) chart.destroy();
    };
  }, [state]);

  if (state.status === "loading") {
    return <p className="border-b border-slate-200 bg-white p-6 text-sm text-slate-600" role="status">Đang tổng hợp dữ liệu lịch hẹn…</p>;
  }
  if (state.status === "error") {
    return (
      <div className="border-b border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-red-700" role="alert">Chưa thể tải dữ liệu biểu đồ lịch hẹn. Bạn có thể thử lại.</p>
        <button className="mt-4 min-h-11 border border-teal-700 px-4 text-sm font-bold text-teal-800 transition-colors hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 active:bg-teal-100"
          onClick={() => setAttempt((value) => value + 1)} type="button">Thử lại</button>
      </div>
    );
  }
  const displayedCount = state.slices.reduce((sum, slice) => sum + slice.count, 0);
  if (displayedCount === 0) {
    return (
      <div className="border-b border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Chưa có lịch hẹn để thống kê.</p>
        <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-teal-800 underline underline-offset-4 hover:text-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" href="/admin/appointments">Xem lịch hẹn</Link>
      </div>
    );
  }
  const upcomingCount = state.week.reduce((sum, bucket) => sum + bucket.count, 0);
  return (
    <div className="min-w-0 border-b border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
              <p className="text-sm font-bold tabular-nums text-teal-900">{appointmentCount(displayedCount)} / {appointmentCount(state.total)} lịch hẹn</p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-600">Cả hai biểu đồ chỉ phản ánh trang dữ liệu đang xem, bao gồm mọi trạng thái.</p>
        </div>
        <Link className="inline-flex min-h-11 items-center text-sm font-bold text-teal-800 underline underline-offset-4 hover:text-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" href="/admin/appointments">Xem lịch hẹn</Link>
      </div>
      {chartUnavailable && <p className="mb-4 text-sm text-amber-800" role="status">Trình duyệt chưa thể vẽ biểu đồ. Bạn vẫn có thể xem số liệu bên dưới.</p>}
      <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="min-w-0" aria-labelledby="admin-chart-status-title">
          <h3 className="text-base font-bold text-slate-900" id="admin-chart-status-title">Lịch hẹn theo trạng thái</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Số lượng và tỷ lệ trong {displayedCount} lịch hẹn đang xem.</p>
          <div className="mt-6 grid items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
            {!chartUnavailable && <div className="relative mx-auto h-44 w-44">
              <canvas aria-label={"Phân bố " + displayedCount + " lịch hẹn đang xem theo trạng thái"} ref={statusCanvasRef} role="img" />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tabular-nums text-teal-900">{displayedCount}</span>
                <span className="mt-1 text-xs text-slate-600">lịch hẹn</span>
              </div>
            </div>}
            <dl className="min-w-0 space-y-3">
              {state.slices.map((slice) => (
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm" key={slice.key}>
                  <dt className="flex min-w-0 items-center gap-2 text-slate-700">
                    <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: appointmentStatusColor(slice.key) }} />
                    {slice.label}
                  </dt>
                  <dd className="font-bold tabular-nums text-slate-900">{slice.count}</dd>
                  <dd className="min-w-11 text-right tabular-nums text-slate-600">{appointmentShare(slice.count, displayedCount)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <table className="sr-only">
            <caption>Phân bố lịch hẹn theo trạng thái</caption>
            <thead><tr><th scope="col">Trạng thái</th><th scope="col">Số lượng</th></tr></thead>
            <tbody>{state.slices.map((slice) => <tr key={slice.key}><th scope="row">{slice.label}</th><td>{slice.count}</td></tr>)}</tbody>
          </table>
        </section>
        <section className="min-w-0" aria-labelledby="admin-chart-week-title">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900" id="admin-chart-week-title">Lịch hẹn 7 ngày tới</h3>
            <p className="text-sm font-bold tabular-nums text-teal-900">{upcomingCount} lịch hẹn</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">Từ hôm nay, trong {displayedCount} lịch hẹn đang xem.</p>
          {!chartUnavailable && <div className="relative mt-4 h-56 min-w-0">
            <canvas aria-label="Số lịch hẹn trong 7 ngày tới từ trang dữ liệu đang xem" ref={weekCanvasRef} role="img" />
          </div>}
          <table className="sr-only">
            <caption>Số lịch hẹn trong 7 ngày tới</caption>
            <thead><tr><th scope="col">Ngày</th><th scope="col">Số lượng</th></tr></thead>
            <tbody>{state.week.map((bucket) => <tr key={bucket.iso}><th scope="row">{bucket.label}</th><td>{bucket.count}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
      <details className="mt-6 border-t border-slate-200 pt-3" open={chartUnavailable || undefined}>
        <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-teal-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Xem dữ liệu biểu đồ</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <caption className="sr-only">Dữ liệu lịch hẹn theo ngày</caption>
            <thead><tr className="border-b border-slate-200 text-slate-600"><th className="py-3" scope="col">Ngày</th><th className="py-3 text-right" scope="col">Số lịch hẹn</th></tr></thead>
            <tbody>{state.week.map((bucket) => <tr className="border-b border-slate-100" key={bucket.iso}><th className="py-3 font-normal text-slate-700" scope="row">{bucket.label}</th><td className="py-3 text-right font-bold text-slate-900">{bucket.count}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
