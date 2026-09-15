/**
 * Pure data transforms for the admin appointments chart. Kept free of
 * chart.js/DOM imports so unit tests can run them in plain Node.
 */

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã tiếp nhận",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
  NO_SHOW: "Không đến",
};

export interface AppointmentInsightInput {
  status: string;
  appointmentDate: string;
}

export interface StatusSlice {
  key: string;
  label: string;
  count: number;
}

/** Count appointments per known status, preserving the canonical display order. */
export function summarizeStatuses(items: AppointmentInsightInput[]): StatusSlice[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  }
  const orderedKeys = Object.keys(APPOINTMENT_STATUS_LABELS);
  const slices: StatusSlice[] = [];
  for (const key of orderedKeys) {
    const count = counts.get(key) ?? 0;
    if (count > 0) slices.push({ key, label: APPOINTMENT_STATUS_LABELS[key], count });
    counts.delete(key);
  }
  // Unknown statuses (future enum growth) still appear so totals stay honest.
  for (const [key, count] of counts) {
    slices.push({ key, label: key.replaceAll("_", " "), count });
  }
  return slices;
}

export interface WeekBucket {
  iso: string;
  label: string;
  count: number;
}

const WEEKDAY_LABELS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Group appointments into the next `days` calendar days starting today. */
export function summarizeUpcomingDays(
  items: AppointmentInsightInput[],
  today: Date,
  days = 7,
): WeekBucket[] {
  const buckets = new Map<string, number>();
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    buckets.set(toIsoDate(day), 0);
  }
  for (const item of items) {
    const key = (item.appointmentDate ?? "").slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  return Array.from(buckets.entries()).map(([iso, count]) => {
    const [year, month, day] = iso.split("-").map(Number);
    const label = `${WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()]} ${day}/${month}`;
    return { iso, label, count };
  });
}
