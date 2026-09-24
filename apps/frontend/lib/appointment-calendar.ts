/**
 * Utility functions to export confirmed medical appointments to Google Calendar and .ics (Apple Calendar / Outlook).
 */

export interface CalendarAppointmentInput {
  bookingCode: string;
  patientName?: string;
  doctorName?: string;
  specialtyName?: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm or HH:mm:ss
  endTime: string; // HH:mm or HH:mm:ss
  branchName?: string;
}

function cleanIsoDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function cleanIsoTime(timeStr: string): string {
  const parts = timeStr.split(":");
  const h = parts[0]?.padStart(2, "0") ?? "08";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}${m}00`;
}

/**
 * Builds a direct Google Calendar event creation URL.
 */
export function buildGoogleCalendarUrl(appt: CalendarAppointmentInput): string {
  const doctor = appt.doctorName?.trim() || "Bác sĩ chuyên khoa";
  const specialty = appt.specialtyName?.trim() || "Đa khoa";
  const branch = appt.branchName?.trim() || "Hệ thống Bệnh viện Đa khoa HealthCare";
  const patient = appt.patientName?.trim() || "Bệnh nhân";

  const title = `Lịch khám tại HealthCare: ${doctor} - ${specialty}`;
  const details = [
    `Mã phiếu khám: ${appt.bookingCode}`,
    `Người khám: ${patient}`,
    `Bác sĩ phụ trách: ${doctor}`,
    `Chuyên khoa: ${specialty}`,
    `Cơ sở tiếp nhận: ${branch}`,
    "",
    "Lưu ý quan trọng:",
    "- Vui lòng đến trước giờ hẹn 30 phút để hoàn tất thủ tục tiếp đón.",
    "- Mang theo CCCD/Hộ chiếu và thẻ BHYT (nếu có) cùng mã phiếu khám này.",
    "- Nếu cần đổi lịch hoặc hỗ trợ y tế khẩn cấp, vui lòng liên hệ hotline 1900 1234 hoặc 115.",
  ].join("\n");

  const datePart = cleanIsoDate(appt.appointmentDate);
  const startPart = cleanIsoTime(appt.startTime);
  const endPart = cleanIsoTime(appt.endTime);

  const dates = `${datePart}T${startPart}/${datePart}T${endPart}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: dates,
    ctz: "Asia/Ho_Chi_Minh",
    details: details,
    location: branch,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates an iCalendar (.ics) string and triggers a browser download.
 */
export function downloadIcsFile(appt: CalendarAppointmentInput): void {
  if (typeof window === "undefined") return;

  const doctor = appt.doctorName?.trim() || "Bác sĩ chuyên khoa";
  const specialty = appt.specialtyName?.trim() || "Đa khoa";
  const branch = appt.branchName?.trim() || "Hệ thống Bệnh viện Đa khoa HealthCare";
  const patient = appt.patientName?.trim() || "Bệnh nhân";

  const datePart = cleanIsoDate(appt.appointmentDate);
  const startPart = cleanIsoTime(appt.startTime);
  const endPart = cleanIsoTime(appt.endTime);

  const now = new Date();
  const dtStamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const summary = `Lịch khám tại HealthCare: ${doctor} - ${specialty}`;
  const description = [
    `Mã phiếu khám: ${appt.bookingCode}`,
    `Bệnh nhân: ${patient}`,
    `Bác sĩ: ${doctor}`,
    `Chuyên khoa: ${specialty}`,
    `Cơ sở: ${branch}`,
    "Vui lòng đến trước 30 phút và mang theo CCCD/BHYT.",
  ].join("\\n");

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HealthCare Vietnam//Appointment System//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${appt.bookingCode}-${datePart}@healthcare.id.vn`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Asia/Ho_Chi_Minh:${datePart}T${startPart}`,
    `DTEND;TZID=Asia/Ho_Chi_Minh:${datePart}T${endPart}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${branch}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Nhắc nhở: Bạn có lịch khám bệnh tại HealthCare sau 2 giờ nữa",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const icsBlob = new Blob([icsLines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(icsBlob);

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `lich-kham-${appt.bookingCode}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
