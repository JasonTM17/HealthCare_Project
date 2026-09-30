import test from "node:test";
import assert from "node:assert/strict";
import { buildGoogleCalendarUrl, buildIcsCalendar, buildIcsCalendarMany } from "../lib/appointment-calendar.ts";
import { presentApiError } from "../lib/present-api-error.ts";

test("calendar exports keep only the appointment time and omit medical identifiers", () => {
  const sampleAppointment = {
    appointmentId: "7be34e41-0b64-4d94-a9b0-ae4f9952c28d",
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
    appointmentId: "896393a9-8d37-4ed5-941d-6361814f82ac",
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
    appointmentId: "5a65ce63-70f8-45e5-b988-a7a0fd8d5b47",
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

const icsSample = {
  appointmentId: "3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b",
  bookingCode: "MED-ICS-001",
  appointmentDate: "2026-10-15",
  startTime: "09:30",
  endTime: "10:00",
};

function assertIcsTimezoneContract(ics, label) {
  // RFC 5545: a DTSTART/DTEND carrying TZID must ship the matching VTIMEZONE definition,
  // otherwise Apple Calendar / Outlook fall back to UTC and shift the appointment by 7 hours.
  assert.ok(ics.includes("BEGIN:VTIMEZONE"), `${label} is missing BEGIN:VTIMEZONE`);
  assert.ok(ics.includes("TZID:Asia/Ho_Chi_Minh"), `${label} VTIMEZONE must define TZID=Asia/Ho_Chi_Minh`);
  assert.ok(ics.includes("BEGIN:STANDARD"), `${label} VTIMEZONE must contain a STANDARD component`);
  assert.ok(ics.includes("DTSTART:19700101T000000"), `${label} VTIMEZONE STANDARD needs DTSTART:19700101T000000`);
  assert.ok(ics.includes("TZOFFSETFROM:+0700"), `${label} VTIMEZONE needs TZOFFSETFROM:+0700`);
  assert.ok(ics.includes("TZOFFSETTO:+0700"), `${label} VTIMEZONE needs TZOFFSETTO:+0700`);
  assert.ok(ics.includes("TZNAME:ICT"), `${label} VTIMEZONE needs TZNAME:ICT`);
  assert.ok(ics.includes("END:STANDARD"), `${label} VTIMEZONE must close the STANDARD component`);
  assert.ok(ics.includes("END:VTIMEZONE"), `${label} VTIMEZONE must be closed`);
  // The definition must be present for the TZID actually emitted in the VEVENT lines.
  assert.match(ics, /DTSTART;TZID=Asia\/Ho_Chi_Minh:/u, `${label} events still reference the Asia/Ho_Chi_Minh TZID`);
  assert.ok(ics.indexOf("BEGIN:VTIMEZONE") < ics.indexOf("BEGIN:VEVENT"), `${label} VTIMEZONE should precede VEVENT`);
  // RFC 5545 §3.1: content lines are terminated by CRLF, so the file must end with one.
  assert.ok(ics.endsWith("\r\n"), `${label} must end with a trailing CRLF`);
}

test("buildIcsCalendar embeds the Asia/Ho_Chi_Minh VTIMEZONE and ends with CRLF", () => {
  assertIcsTimezoneContract(buildIcsCalendar(icsSample), "buildIcsCalendar");
});

test("buildIcsCalendarMany embeds the VTIMEZONE once and ends with CRLF", () => {
  const many = buildIcsCalendarMany([
    icsSample,
    { ...icsSample, appointmentId: "9e8d7c6b-5a49-3827-1605-b4c3d2e1f0a9", appointmentDate: "2026-10-16" },
  ]);
  assertIcsTimezoneContract(many, "buildIcsCalendarMany");
  assert.equal(many.split("BEGIN:VTIMEZONE").length - 1, 1, "VTIMEZONE must be embedded once, not per event");
  assert.equal(many.split("BEGIN:VEVENT").length - 1, 2, "both appointments must be present");
});

test("re-exporting one appointment keeps one opaque UID while different appointments differ", () => {
  const appointment = {
    appointmentId: "2bd8f875-665a-4933-97f8-ef4dd22bbfa2",
    bookingCode: "PRIVATE-CODE-001",
    appointmentDate: "2026-12-01",
    startTime: "10:00",
    endTime: "10:30",
  };
  const uid = (ics) => ics.match(/^UID:(.+)$/mu)?.[1];
  const first = uid(buildIcsCalendar(appointment));
  const second = uid(buildIcsCalendar(appointment));
  const third = uid(buildIcsCalendar({ ...appointment, appointmentId: "409b2237-0777-446f-93ac-766d733a189d" }));

  assert.ok(first);
  assert.equal(first, second);
  assert.notEqual(first, third);
  assert.doesNotMatch(first, /PRIVATE-CODE-001|2bd8f875/u);
});
