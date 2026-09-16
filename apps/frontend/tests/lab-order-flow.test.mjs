import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/doctor/dashboard/page.tsx", import.meta.url);
const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);

test("lab results require an order: two-step clinical flow", async () => {
  const [dashboard, apiClient] = await Promise.all([
    readFile(dashboardPath, "utf8"),
    readFile(apiClientPath, "utf8"),
  ]);

  // Step 1 exists as its own action before any result can be published.
  assert.match(dashboard, /Bước 1 — Chỉ định xét nghiệm/);
  assert.match(dashboard, /handleCreateOrder/);
  assert.match(dashboard, /createDoctorDiagnosticOrder/);

  // Step 2 requires selecting an open order; publish is gated on it.
  assert.match(dashboard, /Bước 2 — Công bố kết quả/);
  assert.match(dashboard, /if \(!activePatientId \|\| !selectedOrderId\) return;/);
  assert.match(dashboard, /orderId: selectedOrderId/);
  assert.match(dashboard, /disabled=\{diagnosticOperation === "saving" \|\| !selectedOrderId\}/);

  // Completed orders cannot be re-selected.
  assert.match(
    dashboard,
    /disabled=\{order\.status !== "REQUESTED" && order\.status !== "COLLECTED"\}/,
  );

  // The API client mirrors the contract.
  assert.match(apiClient, /orderId: string;\n  testName: string;/);
  assert.match(apiClient, /\/diagnostic-orders`/);
  assert.match(apiClient, /export async function fetchDoctorDiagnosticOrders/);
});
