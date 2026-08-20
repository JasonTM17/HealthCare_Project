export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

function businessDateParts(now: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function businessDate(offsetDays = 0, now: Date = new Date()): string {
  const values = businessDateParts(now);
  const date = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) + offsetDays,
  ));
  return date.toISOString().slice(0, 10);
}

function parseBusinessDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+07:00`)
    : new Date(value);
}

export function formatBusinessDate(value: string | null | undefined): string {
  if (!value) return "Chưa có ngày";
  const date = parseBusinessDate(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: BUSINESS_TIME_ZONE }).format(date);
}

export function formatBusinessDateTime(value: string): string {
  const date = parseBusinessDate(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: BUSINESS_TIME_ZONE,
      }).format(date);
}

export function businessDateTimeIso(value: string): string {
  return `${value}T00:00:00+07:00`;
}
