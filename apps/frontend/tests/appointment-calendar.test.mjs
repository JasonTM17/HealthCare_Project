import test from "node:test";
import assert from "node:assert/strict";
import { buildGoogleCalendarUrl } from "../lib/appointment-calendar.ts";
import { presentApiError } from "../lib/present-api-error.ts";

test("buildGoogleCalendarUrl formats valid event link with all clinical parameters", () => {
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
  assert.ok(parsedUrl.searchParams.get("text")?.includes("BS Trương Gia Bảo"));
  assert.ok(parsedUrl.searchParams.get("text")?.includes("Tai mũi họng"));
  assert.ok(parsedUrl.searchParams.get("details")?.includes("MED-2026-9988"));
  assert.ok(parsedUrl.searchParams.get("details")?.includes("Nguyễn Văn An"));
  assert.equal(parsedUrl.searchParams.get("location"), "Bệnh viện Đa khoa HealthCare - Cơ sở 1");
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
  assert.ok(parsedUrl.searchParams.get("details")?.includes("MED-001"));
  assert.ok(parsedUrl.searchParams.get("text")?.includes("Bác sĩ chuyên khoa"));
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
