import test from "node:test";
import assert from "node:assert/strict";
import { buildGoogleCalendarUrl, buildIcsCalendar } from "../lib/appointment-calendar.ts";
import { presentApiError } from "../lib/present-api-error.ts";

test("calendar exports keep only the appointment time and omit medical identifiers", () => {
  const sampleAppointment = {
    bookingCode: "MED-2026-9988",
    patientName: "Nguyễn Văn An",
    doctorName: "BS Trương Gia Bảo",
    specialtyName: "Tai mũi họng",
    appointmentDate: "2026-10-15",
    startTime: "09:30:00",
    endTime: "10:00:00",
    branchName: "Bệnh viện Đa khoa HealthCare - Cơ sở 1",
  };

  const urlString = buildGoogleCalendarUrl(sampleAppointment);
  assert.ok(urlString.startsWith("https://calendar.google.com/calendar/render?"));

  const parsedUrl = new URL(urlString);
  assert.equal(parsedUrl.searchParams.get("action"), "TEMPLATE");
  assert.equal(parsedUrl.searchParams.get("ctz"), "Asia/Ho_Chi_Minh");
  assert.equal(parsedUrl.searchParams.get("dates"), "20261015T093000/20261015T100000");
  assert.equal(parsedUrl.searchParams.get("text"), "Lịch hẹn cá nhân");
  assert.equal(parsedUrl.searchParams.has("location"), false);

  const exportedText = `${[...parsedUrl.searchParams.values()].join(" ")} ${buildIcsCalendar(sampleAppointment)}`;
  for (const privateValue of [
    sampleAppointment.bookingCode,
    sampleAppointment.patientName,
    sampleAppointment.doctorName,
    sampleAppointment.specialtyName,
    sampleAppointment.branchName,
    "1900 1234",
  ]) {
    assert.equal(exportedText.includes(privateValue), false, `calendar export disclosed ${privateValue}`);
  }
});

test("buildGoogleCalendarUrl falls back safely when doctor or branch is omitted", () => {
  const minimalAppointment = {
    bookingCode: "MED-001",
    patientName: "Trần Thị Bình",
    appointmentDate: "2026-11-20",
    startTime: "14:00",
    endTime: "14:30",
  };

  const urlString = buildGoogleCalendarUrl(minimalAppointment);
  const parsedUrl = new URL(urlString);
  assert.equal(parsedUrl.searchParams.get("dates"), "20261120T140000/20261120T143000");
  assert.equal(parsedUrl.searchParams.get("text"), "Lịch hẹn cá nhân");
  assert.equal(parsedUrl.searchParams.has("location"), false);
});

test("presentApiError correctly translates BFF upstream cold-start and timeout codes", () => {
  const unavailableMsg = presentApiError("BFF_UPSTREAM_UNAVAILABLE");
  assert.equal(
    unavailableMsg,
    "Máy chủ y tế đang kết nối lại (khoảng 15-30 giây). Vui lòng đợi trong giây lát rồi thử lại."
  );

  const timeoutMsg = presentApiError("BFF_UPSTREAM_TIMEOUT");
  assert.equal(
    timeoutMsg,
    "Máy chủ y tế phản hồi chậm. Vui lòng đợi trong giây lát rồi thử lại."
  );
});

test("calendar exports do not encode booking identity when patientName is omitted", () => {
  const apptWithoutPatient = {
    bookingCode: "APT-PORTAL-999",
    doctorName: "BS Lê Văn C",
    appointmentDate: "2026-12-01",
    startTime: "10:00:00",
    endTime: "10:30:00",
  };

  const url = buildGoogleCalendarUrl(apptWithoutPatient);
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("text"), "Lịch hẹn cá nhân");
  assert.doesNotMatch([...parsed.searchParams.values()].join(" "), /APT-PORTAL-999|BS Lê Văn C|HealthCare/u);
  const ics = buildIcsCalendar(apptWithoutPatient);
  assert.match(ics, /DTSTART;TZID=Asia\/Ho_Chi_Minh:20261201T100000/u);
  assert.match(ics, /DTEND;TZID=Asia\/Ho_Chi_Minh:20261201T103000/u);
  assert.doesNotMatch(ics, /APT-PORTAL-999|BS Lê Văn C|HealthCare/u);
});
