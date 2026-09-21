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

test("the doctor appointment client keeps the single-day call shape and adds the bounded range", async () => {
  const source = await read("lib/api-client.ts");
  const helperStart = source.indexOf("export interface DoctorAppointmentQuery");
  const helperEnd = source.indexOf("export async function fetchDoctorProfile");
  assert.ok(helperStart > 0 && helperEnd > helperStart, "DoctorAppointmentQuery must precede fetchDoctorProfile");
  const helper = source.slice(helperStart, helperEnd);

  // One query object drives both wire shapes; `date` and `from`/`to` are
  // alternatives, never sent together.
  assert.match(helper, /export interface DoctorAppointmentQuery \{/);
  for (const field of ["date", "from", "to", "status", "page", "size"]) {
    assert.match(helper, new RegExp(`\\n  ${field}\\?:`), `DoctorAppointmentQuery must expose ${field}`);
  }
  assert.match(helper, /dateOrQuery: string \| DoctorAppointmentQuery/);
  assert.match(helper, /from: askedDate \? undefined : askedFrom/);
  assert.match(helper, /to: askedDate \? undefined : askedTo/);
  assert.match(
    helper,
    /if \(!askedDate && !\(askedFrom && askedTo\)\)/,
    "a range request must require both bounds before any network call",
  );
  assert.doesNotMatch(helper, /localStorage|sessionStorage/);

  // Roster reads are doctor-scoped, read-only, and carry no doctorId filter.
  assert.match(helper, /export async function fetchDoctorSchedules\(\): Promise<DoctorRosterEntry\[\]>/);
  assert.match(helper, /getAuthenticatedJson<DoctorRosterEntry\[\]>\("\/doctor\/schedules"\)/);
  assert.match(helper, /export async function fetchDoctorScheduleExceptions\(\): Promise<DoctorRosterException\[\]>/);
  assert.match(helper, /getAuthenticatedJson<DoctorRosterException\[\]>\("\/doctor\/schedule-exceptions"\)/);
  assert.match(helper, /export interface DoctorRosterEntry \{[\s\S]*dayOfWeek: number[\s\S]*slotDurationMinutes: number[\s\S]*active: boolean/);
  assert.match(helper, /export interface DoctorRosterException \{[\s\S]*exceptionDate: string[\s\S]*type: string/);
});

test("the admin cancel helper posts one legal transition and keeps the reason optional", async () => {
  const source = await read("lib/api-client.ts");
  const helperStart = source.indexOf("export async function adminCancelAppointment");
  const helperEnd = source.indexOf("export async function fetchPatientProfile");
  assert.ok(helperStart > 0 && helperEnd > helperStart, "adminCancelAppointment must exist beside adminListAppointments");
  const helper = source.slice(helperStart, helperEnd);

  assert.match(helper, /getAuthenticatedJson<AppointmentDetails>/);
  assert.match(helper, /`\/admin\/appointments\/\$\{encodeURIComponent\(appointmentId\)\}\/status`/);
  assert.match(helper, /method: "POST"/);
  assert.match(helper, /status: "CANCELLED"/);
  // The reason is trimmed and omitted entirely when empty, so the backend's
  // @Size(max = 500) never receives a blank string.
  assert.match(helper, /const trimmedReason = reason\?\.trim\(\)/);
  assert.match(helper, /reason: trimmedReason \|\| undefined/);
});

test("the schedule client forwards force only where the backend reads it", async () => {
  const source = await read("lib/api-client.ts");
  const helperStart = source.indexOf("const forceFlagQuery");
  const helperEnd = source.indexOf("// ── Admin: Services");
  assert.ok(helperStart > 0 && helperEnd > helperStart, "the force helper must live in the admin schedule block");
  const helper = source.slice(helperStart, helperEnd);

  assert.match(helper, /const forceFlagQuery = \(force: boolean\) => toQuery\(\{ force: force \? "true" : undefined \}\)/);
  // update / delete schedule and create / update exception accept the flag…
  assert.match(helper, /adminUpdateSchedule = \(id: string, payload: AdminSchedulePayload, force = false\)[\s\S]*forceFlagQuery\(force\)/);
  assert.match(helper, /adminDeleteSchedule = \(id: string, force = false\)[\s\S]*forceFlagQuery\(force\)/);
  assert.match(helper, /adminCreateScheduleException = \(doctorId: string, branchId: string, payload: AdminScheduleExceptionPayload, force = false\)[\s\S]*forceFlagQuery\(force\)/);
  assert.match(helper, /adminUpdateScheduleException = \(id: string, payload: AdminScheduleExceptionPayload, force = false\)[\s\S]*forceFlagQuery\(force\)/);
  // …while the two endpoints that do not read it must not pretend to.
  assert.match(helper, /adminCreateSchedule = \(doctorId: string, branchId: string, payload: AdminSchedulePayload\) =>/);
  assert.match(helper, /adminDeleteScheduleException = \(id: string\) =>/);
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

test("selecting a doctor appointment also opens that patient's clinical context", async () => {
  const [doctor, api] = await Promise.all([
    read("app/doctor/dashboard/page.tsx"),
    read("lib/api-client.ts"),
  ]);

  const selectStart = doctor.indexOf("const handleSelectAppointment");
  const selectEnd = doctor.indexOf("const handleUpdateAppointmentStatus");
  assert.ok(selectStart > 0 && selectEnd > selectStart, "handleSelectAppointment must exist");
  const handler = doctor.slice(selectStart, selectEnd);

  // The row already carries the authorized patient id, so the history and
  // diagnostic panels load from it — no UUID copy-paste step.
  assert.match(handler, /setPatientId\(appointment\.patientId\)/);
  assert.match(handler, /void loadPatient\(appointment\.patientId\)/);
  assert.match(handler, /appointmentId: appointment\.id/);
  assert.match(handler, /patientId: appointment\.patientId/);
  // The scroll-to-anchor affordance is preserved.
  assert.match(handler, /scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(handler, /getElementById\("clinical-entry"\)/);

  // Prescription draft rows carry their own identity instead of the array index.
  assert.match(doctor, /rowId: string/);
  assert.match(doctor, /key=\{item\.rowId\}/);
  assert.doesNotMatch(doctor, /key=\{itemIndex\}/);
  assert.match(doctor, /function nextPrescriptionRowId\(\): string/);
  assert.match(doctor, /function emptyPrescriptionItem\(\): PrescriptionItemDraft/);

  // Both read-only clinical-context inputs are addressable and labelled.
  assert.match(doctor, /htmlFor="clinical-context-patient-id"/);
  assert.match(doctor, /id="clinical-context-patient-id"/);
  assert.match(doctor, /htmlFor="clinical-context-appointment-id"/);
  assert.match(doctor, /id="clinical-context-appointment-id"/);
  assert.match(doctor, /id="clinical-context-help"/);

  assert.match(api, /export interface DoctorRosterEntry/);
});

test("the doctor dashboard renders a read-only roster and a seven-day appointment window", async () => {
  const doctor = await read("app/doctor/dashboard/page.tsx");

  assert.match(doctor, /fetchDoctorSchedules\(\)/);
  assert.match(doctor, /fetchDoctorScheduleExceptions\(\)/);
  assert.match(doctor, /LỊCH LÀM VIỆC CỦA TÔI/);
  assert.match(doctor, /Chưa có lịch làm việc — liên hệ quản trị viên\./);
  assert.match(doctor, /Ngoại lệ/);
  assert.match(doctor, /ROSTER_EXCEPTION_LABELS/);
  assert.match(doctor, /<details/);
  // Weekly rows are labelled by day, and sorted by day then start time.
  assert.match(doctor, /ROSTER_DAY_LABELS = \["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"\]/);
  assert.match(doctor, /left\.dayOfWeek - right\.dayOfWeek \|\| left\.startTime\.localeCompare\(right\.startTime\)/);

  // The daily panel keeps its single-day default and gains the range segment.
  assert.match(doctor, /useState<"day" \| "range">\("day"\)/);
  assert.match(doctor, /aria-pressed=\{appointmentView === "day"\}/);
  assert.match(doctor, /aria-pressed=\{appointmentView === "range"\}/);
  assert.match(doctor, /Hôm nay/);
  assert.match(doctor, /7 ngày tới/);
  assert.match(doctor, /from: anchor/);
  assert.match(doctor, /to: addDaysIso\(anchor, 7\)/);
  // The range view groups by date and reuses the shared appointment rows.
  assert.match(doctor, /function groupAppointmentsByDate/);
  assert.match(doctor, /function renderRangeAppointments/);
  assert.match(doctor, /portal-appointment-list|PortalAppointments onSelectAppointment=\{onSelectAppointment\} onUpdateStatus=\{onUpdateStatus\} page=\{group\.page\} viewer="doctor"/);
  // Every page of the window is loaded so a busy week cannot be truncated.
  assert.match(doctor, /fetchAllContent\(/);
});

test("the admin appointment table cancels through one dialog and commits the returned row", async () => {
  const [appointments, api] = await Promise.all([
    read("app/admin/appointments/page.tsx"),
    read("lib/api-client.ts"),
  ]);

  assert.match(api, /export async function adminCancelAppointment/);
  assert.match(appointments, /adminCancelAppointment\(appointment\.id, reason \|\| undefined\)/);
  // One confirm dialog, no window.confirm, and it carries an optional reason.
  assert.match(appointments, /ConfirmActionDialog/);
  assert.doesNotMatch(appointments, /window\.confirm/);
  assert.match(appointments, /name: "reason"/);
  assert.match(appointments, /maxLength: CANCEL_REASON_MAX_LENGTH/);
  assert.match(appointments, /onConfirm=\{\(values\) => \{/);
  // The server's row replaces the listed one; the page is not refetched.
  assert.match(appointments, /item\.id === updated\.id \? updated : item/);
  assert.match(appointments, /Đã hủy lịch \$\{updated\.bookingCode\}/);
  // Terminal statuses cannot be re-cancelled.
  assert.match(appointments, /const TERMINAL_STATUSES = \["COMPLETED", "CANCELLED", "NO_SHOW"\]/);
  assert.match(appointments, /disabled=\{!isCancellable\(item\) \|\| cancelBusy\}/);
  assert.match(appointments, /statusLabel\(item\.status\)/);
  // Failures surface through the shared admin copy, never a raw error object.
  assert.match(appointments, /setCancelError\(describeAdminError\(cause\)\.description\)/);
  assert.doesNotMatch(appointments, /cause\.message/);
});
