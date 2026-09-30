/**
 * Utility functions to export confirmed medical appointments to Google Calendar and .ics (Apple Calendar / Outlook).
 */

export interface CalendarAppointmentInput {
  appointmentId: string;
  bookingCode: string;
  patientName?: string;
  doctorName?: string;
  specialtyName?: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm or HH:mm:ss
  endTime: string; // HH:mm or HH:mm:ss
  branchName?: string;
}

const calendarUids = new Map<string, string>();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function calendarUid(appointmentId: string): string {
  const cached = calendarUids.get(appointmentId);
  if (cached) return cached;

  const storageKey = `healthcare:calendar-uid:${appointmentId}`;
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored && UUID_PATTERN.test(stored)) {
        calendarUids.set(appointmentId, stored);
        return stored;
      }
    } catch {
      // Private browsing can block storage; keep the UID stable for this page.
    }
  }

  const uid = globalThis.crypto.randomUUID();
  calendarUids.set(appointmentId, uid);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey, uid);
    } catch {
      // The in-memory UID still prevents duplicate imports within this page.
    }
  }
  return uid;
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

/** Keep third-party calendar URLs free of patient and visit details. */
export function buildGoogleCalendarUrl(appt: CalendarAppointmentInput): string {
  const datePart = cleanIsoDate(appt.appointmentDate);
  const startPart = cleanIsoTime(appt.startTime);
  const endPart = cleanIsoTime(appt.endTime);

  const dates = `${datePart}T${startPart}/${datePart}T${endPart}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Lịch hẹn cá nhân",
    dates: dates,
    ctz: "Asia/Ho_Chi_Minh",
    details: "Xem thông tin chi tiết trong ứng dụng nơi bạn đặt lịch.",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * RFC 5545 requires every TZID used in DTSTART/DTEND to be defined by a VTIMEZONE in
 * the same calendar; without it Apple Calendar / Outlook fall back to UTC and the
 * appointment shifts by 7 hours. Asia/Ho_Chi_Minh (ICT) has had no DST since 1970,
 * so a single static STANDARD component with fixed +07:00 offsets is correct.
 */
const VTIMEZONE_ASIA_HO_CHI_MINH: string[] = [
  "BEGIN:VTIMEZONE",
  "TZID:Asia/Ho_Chi_Minh",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0700",
  "TZOFFSETTO:+0700",
  "TZNAME:ICT",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function buildVevent(appt: CalendarAppointmentInput): string[] {
  const datePart = cleanIsoDate(appt.appointmentDate);
  const startPart = cleanIsoTime(appt.startTime);
  const endPart = cleanIsoTime(appt.endTime);

  const now = new Date();
  const dtStamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  return [
    "BEGIN:VEVENT",
    `UID:${calendarUid(appt.appointmentId)}@calendar.local`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Asia/Ho_Chi_Minh:${datePart}T${startPart}`,
    `DTEND;TZID=Asia/Ho_Chi_Minh:${datePart}T${endPart}`,
    "SUMMARY:Lịch hẹn cá nhân",
    "DESCRIPTION:Xem thông tin chi tiết trong ứng dụng nơi bạn đặt lịch.",
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Nhắc bạn về lịch hẹn sau 2 giờ nữa",
    "END:VALARM",
    "END:VEVENT",
  ];
}

/** The downloadable event may later be imported into a cloud calendar. */
export function buildIcsCalendar(appt: CalendarAppointmentInput): string {
  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal Appointment Reminder//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE_ASIA_HO_CHI_MINH,
    ...buildVevent(appt),
    "END:VCALENDAR",
  ];

  return icsLines.join("\r\n") + "\r\n";
}

/** One file, many events: a doctor exports a whole day or 7-day range in a single click. */
export function buildIcsCalendarMany(appointments: CalendarAppointmentInput[]): string {
  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal Appointment Reminder//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE_ASIA_HO_CHI_MINH,
    ...appointments.flatMap(buildVevent),
    "END:VCALENDAR",
  ];

  return icsLines.join("\r\n") + "\r\n";
}

function triggerIcsDownload(icsContent: string, filename: string): void {
  if (typeof window === "undefined") return;

  const icsBlob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(icsBlob);

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

/** Generates a private iCalendar (.ics) reminder and triggers a browser download. */
export function downloadIcsFile(appt: CalendarAppointmentInput): void {
  triggerIcsDownload(buildIcsCalendar(appt), "lich-hen.ics");
}

/** Exports several appointments (a doctor's day or 7-day range) as one .ics file. */
export function downloadIcsCalendarManyFile(appointments: CalendarAppointmentInput[], filename = "lich-kham-bac-si.ics"): void {
  if (appointments.length === 0) return;
  triggerIcsDownload(buildIcsCalendarMany(appointments), filename);
}
