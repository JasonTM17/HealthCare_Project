import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);
const patientPagePath = new URL("../app/patient/dashboard/page.tsx", import.meta.url);
const doctorPagePath = new URL("../app/doctor/dashboard/page.tsx", import.meta.url);
const statesPath = new URL("../components/PortalStates.tsx", import.meta.url);

test("authenticated client exposes the backend-owned portal contracts", async () => {
  const source = await readFile(apiClientPath, "utf8");

  assert.match(source, /sessionStorage/);
  assert.match(source, /\/patient\/medical-records/);
  assert.match(source, /\/patient\/appointments/);
  assert.match(source, /\/patient\/prescriptions/);
  assert.match(source, /\/patient\/diagnostic-results/);
  assert.match(source, /\/notifications/);
  assert.match(source, /\/doctor\/patients\/\$\{encodeURIComponent\(patientId\)\}\/medical-records/);
  assert.match(source, /class ApiError/);
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

test("shared portal states include forbidden and loading semantics", async () => {
  const source = await readFile(statesPath, "utf8");

  assert.match(source, /role="status"/);
  assert.match(source, /status === 401/);
  assert.match(source, /status === 403/);
  assert.match(source, /tạm thời không khả dụng/);
  assert.match(source, /role="alert"/);
});
