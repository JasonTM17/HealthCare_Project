import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function load(path) {
  const source = readFileSync(new URL(`../components/charts/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const runtime = { exports: {} };
  vm.runInNewContext(compiled, { module: runtime, exports: runtime.exports, require(name) { throw new Error(`Unexpected runtime dependency: ${name}`); } });
  return runtime.exports;
}
const presentation = load("admin-appointment-chart-config.ts");
const insights = load("adminAppointmentInsights.ts");

test("status color follows identity across subsets and shares use the displayed count", () => {
  const cancelled = { key: "CANCELLED", label: "Đã hủy", count: 17 };
  const one = presentation.statusChartConfig([cancelled], false, "Be Vietnam Pro");
  const full = presentation.statusChartConfig([{ key: "CONFIRMED", label: "Đã xác nhận", count: 62 }, cancelled], false, "Be Vietnam Pro");
  assert.equal(one.data.datasets[0].backgroundColor[0], full.data.datasets[0].backgroundColor[1]);
  assert.notEqual(presentation.appointmentStatusColor("CONFIRMED"), presentation.appointmentStatusColor("CANCELLED"));
  assert.equal(presentation.appointmentShare(62, 100), "62%");
  assert.equal(presentation.appointmentShare(1, 3), "33,3%");
  assert.equal(presentation.appointmentShare(0, 0), "0%");
  assert.ok(presentation.appointmentStatusColor("FUTURE_STATUS"));
  assert.equal(full.options.animation, false);
});

test("week labels stay compact while full-date tooltip and data remain exact", () => {
  const buckets = insights.summarizeUpcomingDays([{ status: "CANCELLED", appointmentDate: "2026-10-11" },
    { status: "CONFIRMED", appointmentDate: "2026-10-12" }, { status: "COMPLETED", appointmentDate: "2026-11-01" }], new Date(2026, 9, 11));
  const config = presentation.weekChartConfig(buckets, false, "Be Vietnam Pro");
  assert.equal(JSON.stringify(config.data.labels[0]), JSON.stringify(["CN", "11/10"]));
  assert.equal(JSON.stringify(config.data.labels[1]), JSON.stringify(["T2", "12/10"]));
  assert.equal(JSON.stringify(config.data.datasets[0].data), JSON.stringify([1, 1, 0, 0, 0, 0, 0]));
  assert.equal(config.options.plugins.tooltip.callbacks.title([{ dataIndex: 0 }]), "Chủ nhật 11/10");
  assert.equal(config.options.scales.x.ticks.maxRotation, 0);
  assert.equal(config.options.scales.y.ticks.precision, 0);
  assert.equal(config.options.animation, false);
});

test("unknown statuses and month boundaries preserve every authorized input count", () => {
  const input = [{ status: "FUTURE_STATUS", appointmentDate: "2026-10-31" }, { status: "CONFIRMED", appointmentDate: "2026-11-01" }];
  assert.equal(insights.summarizeStatuses(input).reduce((sum, slice) => sum + slice.count, 0), 2);
  const week = insights.summarizeUpcomingDays(input, new Date(2026, 9, 31));
  assert.equal(week[1].iso, "2026-11-01");
  assert.equal(week.reduce((sum, bucket) => sum + bucket.count, 0), 2);
});
