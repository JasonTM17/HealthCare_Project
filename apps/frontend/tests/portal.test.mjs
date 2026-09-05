import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);
const patientPagePath = new URL("../app/patient/dashboard/page.tsx", import.meta.url);
const doctorPagePath = new URL("../app/doctor/dashboard/page.tsx", import.meta.url);
const statesPath = new URL("../components/PortalStates.tsx", import.meta.url);
const chromePath = new URL("../components/PortalChrome.tsx", import.meta.url);
const accessGatePath = new URL("../components/PortalAccessGate.tsx", import.meta.url);
const patientLayoutPath = new URL("../app/patient/layout.tsx", import.meta.url);
const doctorLayoutPath = new URL("../app/doctor/layout.tsx", import.meta.url);
const stylesPath = new URL("../app/styles.css", import.meta.url);
const patientAliasRoutes = [
  ["../app/patient/page.tsx", "/patient/dashboard"],
  ["../app/patient/appointments/page.tsx", "/patient/dashboard#appointments"],
  ["../app/patient/appointments/[id]/page.tsx", "/patient/dashboard?appointmentId="],
  ["../app/patient/medical-records/page.tsx", "/patient/dashboard#records"],
  ["../app/patient/prescriptions/page.tsx", "/patient/dashboard#prescriptions"],
  ["../app/patient/diagnostic-results/page.tsx", "/patient/dashboard#diagnostics"],
  ["../app/patient/documents/page.tsx", "/patient/dashboard#records"],
  ["../app/patient/notifications/page.tsx", "/patient/dashboard#notifications"],
  ["../app/doctor/page.tsx", "/doctor/dashboard"],
  ["../app/doctor/appointments/page.tsx", "/doctor/dashboard#daily-appointments"],
];

test("authenticated client exposes portal contracts without browser bearer storage", async () => {
  const source = await readFile(apiClientPath, "utf8");

  assert.match(source, /\/auth\/browser-sessions\/current/);
  assert.match(source, /credentials: "same-origin"/);
  assert.doesNotMatch(source, /sessionStorage|localStorage|Authorization|Bearer|accessToken|refreshToken|tokenType/);
  assert.match(source, /\/patient\/medical-records/);
  assert.match(source, /\/patient\/appointments/);
  assert.match(source, /\/patient\/prescriptions/);
  assert.match(source, /\/patient\/diagnostic-results/);
  assert.match(source, /\/notifications/);
  assert.match(source, /\/doctor\/patients\/\$\{encodeURIComponent\(patientId\)\}\/medical-records/);
  assert.match(source, /class ApiError/);
});

test("patient and doctor layouts defer children until cookie-session hydration settles", async () => {
  const [gate, patientLayout, doctorLayout] = await Promise.all([
    readFile(accessGatePath, "utf8"),
    readFile(patientLayoutPath, "utf8"),
    readFile(doctorLayoutPath, "utf8"),
  ]);

  assert.match(gate, /useAuthSessionStatus/);
  assert.match(gate, /hydrationStatus !== "settled"/);
  assert.match(gate, /LoadingState/);
  assert.match(gate, /window\.location\.pathname/);
  assert.match(gate, /window\.location\.search/);
  assert.match(gate, /window\.location\.hash/);
  assert.match(gate, /!currentPath\.startsWith\("\/"\)/);
  assert.match(gate, /currentPath\.startsWith\("\/\/"\)/);
  assert.match(gate, /RETURN_PATH_CONTROL_PATTERN\.test\(currentPath\)/);
  assert.match(gate, /if \(!session\)[\s\S]*LoginRequiredState/);
  assert.match(gate, /if \(!hasRole\(session\.user, role\)\)[\s\S]*ForbiddenState/);
  assert.match(gate, /return children/);
  assert.match(patientLayout, /PortalAccessGate role="PATIENT"/);
  assert.match(doctorLayout, /PortalAccessGate role="DOCTOR"/);
  assert.ok(
    gate.indexOf('hydrationStatus !== "settled"') < gate.indexOf("return children"),
    "children must not mount before cookie-session hydration has settled",
  );
});

test("patient portal keeps missing appointment list data explicit", async () => {
  const source = await readFile(patientPagePath, "utf8");

  assert.match(source, /Lịch hẹn của tôi/);
  assert.match(source, /fetchPatientAppointments/);
  assert.match(source, /LỊCH HẸN ĐÃ XÁC THỰC/);
  assert.match(source, /PortalAppointments/);
  assert.match(source, /không dựng dữ liệu mẫu/);
  assert.match(source, /LoginRequiredState/);
  assert.match(source, /ErrorState/);
  assert.match(source, /EmptyState/);
});

test("doctor portal only renders authorized patient clinical lookup", async () => {
  const source = await readFile(doctorPagePath, "utf8");

  assert.match(source, /Lịch làm việc theo ngày/);
  assert.match(source, /fetchDoctorAppointments/);
  assert.match(source, /LỊCH HẸN ĐÃ XÁC THỰC/);
  assert.match(source, /daily-appointment-date/);
  assert.match(source, /daily-appointment-status/);
  assert.match(source, /PortalAppointments/);
  assert.match(source, /fetchDoctorPatientMedicalRecords/);
  assert.match(source, /fetchDoctorPatientDiagnosticResults/);
  assert.match(source, /UUID_PATTERN/);
});

test("portal alias routes redirect to the dashboard anchors that already own the live data", async () => {
  for (const [relativePath, destination] of patientAliasRoutes) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /redirect\(\s*["'`]/);
    assert.match(source, new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const appointmentDetail = await readFile(new URL("../app/patient/appointments/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(appointmentDetail, /encodeURIComponent\(id\)/);
  assert.match(appointmentDetail, /appointmentId=/);
  assert.match(appointmentDetail, /#appointments/);
});

test("shared portal states include forbidden and loading semantics", async () => {
  const source = await readFile(statesPath, "utf8");

  assert.match(source, /role="status"/);
  assert.match(source, /status === 401/);
  assert.match(source, /status === 403/);
  assert.match(source, /tạm thời không khả dụng/);
  assert.match(source, /role="alert"/);
});

test("portal chrome exposes complete role navigation and keyboard landmarks", async () => {
  const source = await readFile(chromePath, "utf8");

  assert.match(source, /href="#portal-main-content"/);
  assert.match(source, /id="portal-main-content"/);
  assert.match(source, /tabIndex=\{-1\}/);
  assert.match(source, /\/patient\/appointments/);
  assert.match(source, /\/patient\/chat/);
  assert.match(source, /\/patient\/preferences/);
  assert.match(source, /\/doctor\/appointments/);
  assert.match(source, /aria-current/);
  assert.match(source, /logoutCurrentUser/);
  assert.match(source, /SAFE_LOGOUT_ERROR_MESSAGE/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /const outcome = await logoutCurrentUser\(\)/);
  assert.match(source, /outcome\.status === "LOGGED_OUT"[\s\S]*?router\.replace\("\/auth\/login"\)/);
  assert.match(source, /else\s*\{\s*setLogoutError\(SAFE_LOGOUT_ERROR_MESSAGE\)/);
  assert.match(source, /setLoggingOut\(false\)/);
  assert.doesNotMatch(source, /logoutCurrentUser clears the browser session even when remote sign-out is unavailable/);
  assert.doesNotMatch(source, /finally\s*\{[^}]*router\.replace\("\/auth\/login/);
  assert.match(source, /<BrandMark size="compact" tagline=\{ROLE_LABEL\[role\]\} \/>/);
});

test("portal styling stays dense, fixed-scale, touch-safe, and responsive", async () => {
  const source = await readFile(stylesPath, "utf8");
  const start = source.indexOf(".portal-shell");
  const end = source.indexOf("/* Hospital public-site redesign", start);
  const portalStyles = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(portalStyles, /font-size:\s*clamp\(/);
  assert.match(portalStyles, /\.portal-summary-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4/);
  assert.match(portalStyles, /\.portal-panel\s*\{[\s\S]*?border-top:[\s\S]*?box-shadow:\s*none/);
  assert.match(portalStyles, /\.portal-context-link\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(portalStyles, /@media \(max-width:\s*640px\)[\s\S]*?\.portal-nav\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  assert.doesNotMatch(portalStyles, /\.portal-nav\s*,\s*\.portal-summary-grid\s*\{[\s\S]*?grid-template-columns/);
  assert.match(portalStyles, /prefers-reduced-motion/);
});
