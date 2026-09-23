import type { DoctorSchedule } from "../../../types/hospital";

/**
 * Pure helpers for the week-grid view of the admin schedules page. Kept free of
 * React so the deterministic parts (branch tint, shift-row derivation, week
 * windowing) can be exercised directly by `node --test`.
 */

/**
 * Small fixed palette. A branch's chip color is `hash(branchId) % palette`, so
 * the same branch always renders the same tint across days and reloads. The
 * class strings are written out in full so Tailwind's scanner keeps them.
 */
export const BRANCH_TINTS = [
  "bg-teal-50 border-teal-300 text-teal-900",
  "bg-sky-50 border-sky-300 text-sky-900",
  "bg-violet-50 border-violet-300 text-violet-900",
  "bg-amber-50 border-amber-300 text-amber-900",
  "bg-rose-50 border-rose-300 text-rose-900",
  "bg-emerald-50 border-emerald-300 text-emerald-900",
] as const;

/** FNV-1a over UTF-16 code units — deterministic across runs and platforms. */
export function branchTintIndex(branchId: string, paletteLength: number = BRANCH_TINTS.length): number {
  let hash = 2166136261;
  for (let index = 0; index < branchId.length; index += 1) {
    hash ^= branchId.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return paletteLength > 0 ? hash % paletteLength : 0;
}

export function branchChipTint(branchId: string): string {
  return BRANCH_TINTS[branchTintIndex(branchId)];
}

/** Display abbreviations for the common Vietnamese facility prefixes. */
const BRANCH_SHORT_PREFIXES: [string, string][] = [
  ["Bệnh viện", "BV"],
  ["Phòng khám", "PK"],
  ["Trung tâm", "TT"],
  ["Cơ sở", "CS"],
];

/** Compact branch label for chips; the full name belongs in the tooltip. */
export function branchShortName(name: string): string {
  const trimmed = name.trim();
  let short = trimmed;
  const lower = trimmed.toLowerCase();
  for (const [full, abbr] of BRANCH_SHORT_PREFIXES) {
    if (lower.startsWith(full.toLowerCase())) {
      short = abbr + trimmed.slice(full.length);
      break;
    }
  }
  short = short.replace(/\s+/g, " ").trim();
  return short.length > 24 ? `${short.slice(0, 23)}…` : short;
}

export interface ShiftRow {
  key: string;
  startTime: string;
  endTime: string;
}

function hhmm(value: string): string {
  return value.slice(0, 5);
}

function toDayMinutes(value: string): number {
  const [hours, minutes] = hhmm(value).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function shiftRowKey(schedule: DoctorSchedule): string {
  return `${hhmm(schedule.startTime)}-${hhmm(schedule.endTime)}`;
}

/**
 * Grid rows are the distinct shift windows actually present in the data
 * (e.g. 07:00-11:00 and 11:00-17:00), sorted by start time — not a fixed
 * hour ladder, so the grid never invents empty structure the clinic doesn't run.
 */
export function deriveShiftRows(schedules: DoctorSchedule[]): ShiftRow[] {
  const rows = new Map<string, ShiftRow>();
  for (const schedule of schedules) {
    const key = shiftRowKey(schedule);
    rows.set(key, { key, startTime: hhmm(schedule.startTime), endTime: hhmm(schedule.endTime) });
  }
  return [...rows.values()].sort(
    (left, right) => toDayMinutes(left.startTime) - toDayMinutes(right.startTime)
      || toDayMinutes(left.endTime) - toDayMinutes(right.endTime),
  );
}

export interface WeekDay {
  date: string;
  /** ISO weekday: Monday = 1 … Sunday = 7, matching the page's dayNames array. */
  dayOfWeek: number;
}

/** ISO date shifted by whole days; returns the input unchanged when unparseable. */
export function addDays(iso: string, days: number): string {
  const time = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(time)) return iso;
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}

export function isoDayOfWeek(iso: string): number {
  const time = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(time)) return 0;
  const jsDay = new Date(time).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/** Seven-day window starting at the anchor date (the anchor need not be a Monday). */
export function weekDaysFrom(anchor: string): WeekDay[] {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(anchor, offset);
    return { date, dayOfWeek: isoDayOfWeek(date) };
  });
}

/** Weekly rule applies on a concrete date: matching weekday plus effective range. */
export function scheduleAppliesOnDate(schedule: DoctorSchedule, date: string): boolean {
  if (schedule.dayOfWeek !== isoDayOfWeek(date)) return false;
  if (schedule.effectiveFrom && date < schedule.effectiveFrom.slice(0, 10)) return false;
  if (schedule.effectiveTo && date > schedule.effectiveTo.slice(0, 10)) return false;
  return true;
}

export function schedulesForCell(schedules: DoctorSchedule[], date: string, rowKey: string): DoctorSchedule[] {
  return schedules.filter((schedule) => scheduleAppliesOnDate(schedule, date) && shiftRowKey(schedule) === rowKey);
}
