import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("admin appointment insights transform covers the full status enum and stays pure", async () => {
  const source = await read("components/charts/adminAppointmentInsights.ts");

  // Every appointment status the admin filter offers must have a Vietnamese label.
  for (const status of ["PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]) {
    assert.match(source, new RegExp(`${status}:\\s*"[^"]+"`));
  }
  // Pure module: no chart.js/DOM/network imports allowed here.
  assert.doesNotMatch(source, /from\s+"chart\.js"/);
  assert.doesNotMatch(source, /fetch\(|document\.|window\./);
  // Unknown statuses must still surface so totals stay honest.
  assert.match(source, /Unknown statuses/);
});

test("admin appointments chart cleans up Chart.js instances and respects reduced motion", async () => {
  const source = await read("components/charts/AdminAppointmentsChart.tsx");

  assert.match(source, /chart\.destroy\(\)/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /aria-label=/);
  // Accessible fallback tables back both canvases.
  const tableCount = (source.match(/<table className="sr-only">/g) ?? []).length;
  assert.equal(tableCount, 2);
});

test("admin dashboard wires the insights section with a labelled heading", async () => {
  const source = await read("app/admin/page.tsx");

  assert.match(source, /import AdminAppointmentsChart/);
  assert.match(source, /admin-chart-insights-title/);
  assert.match(source, /<AdminAppointmentsChart \/>/);
});
