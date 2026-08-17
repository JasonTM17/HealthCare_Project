import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("appointment client uses the documented authenticated Page contracts", async () => {
  const source = await read("lib/api-client.ts");

  assert.match(source, /export async function fetchPatientAppointments/);
  assert.match(source, /getAuthenticatedJson<Page<PatientPortalAppointment>>\(\s*`\/patient\/appointments/);
  assert.match(source, /export async function fetchDoctorAppointments/);
  assert.match(source, /getAuthenticatedJson<Page<DoctorPortalAppointment>>/);
  assert.match(source, /const path = "\/doctor\/appointments"/);
  assert.match(source, /date: normalizedDate, status, page, size/);
  assert.match(source, /YYYY-MM-DD/);
  assert.doesNotMatch(source, /fetchPatientAppointments[\s\S]*SEED_/);
  assert.doesNotMatch(source, /fetchDoctorAppointments[\s\S]*SEED_/);
});

test("appointment surfaces keep state boundaries and avoid symptoms or secrets", async () => {
  const [patient, doctor, component] = await Promise.all([
    read("app/patient/dashboard/page.tsx"),
    read("app/doctor/dashboard/page.tsx"),
    read("components/PortalAppointments.tsx"),
  ]);

  for (const source of [patient, doctor]) {
    assert.match(source, /LoadingState/);
    assert.match(source, /ErrorState/);
    assert.match(source, /EmptyState/);
    assert.match(source, /clearAuthSession/);
    assert.doesNotMatch(source, /console\.(?:log|error|warn)/);
  }
  assert.match(component, /PortalAppointment/);
  assert.match(component, /patientName/);
  assert.match(component, /doctorName/);
  assert.match(component, /Lịch khám của bác sĩ/);
  assert.match(component, /portal-appointment-list/);
  assert.match(component, /statusLabel/);
  assert.doesNotMatch(component, /symptoms|accessToken|refreshToken/i);
});
