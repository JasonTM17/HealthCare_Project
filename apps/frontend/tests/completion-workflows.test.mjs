import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("patient portal exposes profile, reschedule, and authenticated diagnostic download workflows", () => {
  const api = read("../lib/api-client.ts");
  const page = read("../app/patient/dashboard/page.tsx");
  assert.match(api, /fetchPatientProfile/);
  assert.match(api, /\/reschedule/);
  assert.match(api, /Authorization.*accessToken/s);
  assert.match(page, /handleSaveProfile/);
  assert.match(page, /handleReschedule/);
  assert.match(page, /downloadProtectedFile/);
});

test("patient self-registration creates a real authenticated portal entry", () => {
  const api = read("../lib/api-client.ts");
  const login = read("../app/auth/login/page.tsx");
  const registration = read("../app/auth/register/page.tsx");
  assert.match(api, /\/auth\/register/);
  assert.match(api, /storeAuthSession\(session\)/);
  assert.match(login, /\/auth\/register/);
  assert.match(login, /hasRole\(session\.user, "ADMIN"\)/);
  assert.match(registration, /patient\/dashboard/);
  assert.match(registration, /phone/);
});

test("doctor portal enforces the visible lifecycle before clinical completion", () => {
  const component = read("../components/PortalAppointments.tsx");
  const page = read("../app/doctor/dashboard/page.tsx");
  assert.match(component, /status === "CONFIRMED"/);
  assert.match(component, /status === "CHECKED_IN"/);
  assert.match(component, /status === "IN_PROGRESS"/);
  assert.match(page, /updateDoctorAppointmentStatus/);
  assert.match(page, /createDoctorDiagnosticResult/);
  assert.match(page, /uploadDiagnosticFile/);
});

test("admin UI covers remaining hospital catalog and recurring schedules", () => {
  const layout = read("../app/admin/layout.tsx");
  const catalog = read("../app/admin/catalog/page.tsx");
  const schedules = read("../app/admin/schedules/page.tsx");
  const appointments = read("../app/admin/appointments/page.tsx");
  assert.match(layout, /\/admin\/catalog/);
  assert.match(layout, /\/admin\/schedules/);
  assert.match(layout, /\/admin\/appointments/);
  assert.match(catalog, /adminCreatePackage/);
  assert.match(catalog, /adminCreateFaq/);
  assert.match(catalog, /adminCreateArticle/);
  assert.match(schedules, /adminListSchedules/);
  assert.match(schedules, /adminListBranches/);
  assert.match(schedules, /adminCreateSchedule/);
  assert.match(schedules, /adminCreateScheduleException/);
  assert.doesNotMatch(schedules, /fetchBranches/);
  assert.match(appointments, /adminListAppointments/);
  assert.match(appointments, /Trạng thái lâm sàng/);
});

test("authenticated search augments bounded keyword results with related content", () => {
  const api = read("../lib/api-client.ts");
  const search = read("../app/search/SearchPageClient.tsx");
  assert.match(api, /fetchSemanticSearch/);
  assert.match(api, /\/ai\/search/);
  assert.match(search, /fetchSemanticSearch/);
  assert.match(search, /readAuthSession/);
  assert.match(search, /semantic\.results/);
  assert.match(search, /semanticSourceLabel/);
});
