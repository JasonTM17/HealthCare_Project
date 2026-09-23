import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BRANCH_TINTS,
  addDays,
  branchChipTint,
  branchShortName,
  branchTintIndex,
  deriveShiftRows,
  scheduleAppliesOnDate,
  schedulesForCell,
  weekDaysFrom,
} from "../app/admin/schedules/week-grid.ts";

const pageSource = await readFile(new URL("../app/admin/schedules/page.tsx", import.meta.url), "utf8");

function fakeSchedule(overrides) {
  return {
    id: `s-${Math.random()}`,
    doctorId: "d-1",
    doctorName: "Bs Test",
    branchId: "b-1",
    branchName: "Cơ sở 1",
    dayOfWeek: 3,
    startTime: "07:00:00",
    endTime: "11:00:00",
    slotDurationMinutes: 30,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    active: true,
    ...overrides,
  };
}

test("schedules page offers a Tuần/Danh sách toggle defaulting to the week view", () => {
  assert.match(pageSource, /const \[view, setView\] = useState<"week" \| "list">\("week"\)/);
  assert.match(pageSource, /aria-pressed=\{view === "week"\}/);
  assert.match(pageSource, /aria-pressed=\{view === "list"\}/);
  assert.match(pageSource, />\s*Tuần\s*<\/button>/);
  assert.match(pageSource, />\s*Danh sách\s*<\/button>/);
});

test("week view has a date-driven week picker and prev/next navigation", () => {
  assert.match(pageSource, /const \[weekStart, setWeekStart\] = useState\(\(\) => businessDate\(\)\)/);
  assert.match(pageSource, /value=\{weekStart\}/);
  assert.match(pageSource, /type="date"/);
  assert.match(pageSource, /addDays\(current, -7\)/);
  assert.match(pageSource, /addDays\(current, 7\)/);
  assert.match(pageSource, /setWeekStart\(businessDate\(\)\)/);
  // The grid renders only rows derived from real shift windows, never a fixed hour ladder.
  assert.match(pageSource, /deriveShiftRows\(sortedSchedules\)/);
  assert.match(pageSource, /schedulesForCell\(sortedSchedules, day\.date, row\.key\)/);
});

test("Danh sách view paginates client-side at 20 cards per page", () => {
  assert.match(pageSource, /const CALENDAR_LIST_PAGE_SIZE = 20/);
  assert.match(pageSource, /sortedSchedules\.slice\(\s*safeListPage \* CALENDAR_LIST_PAGE_SIZE,\s*\(safeListPage \+ 1\) \* CALENDAR_LIST_PAGE_SIZE,\s*\)/);
  assert.match(pageSource, /\{pagedSchedules\.map\(\(item\) => \(/);
  assert.match(pageSource, /aria-label="Phân trang lịch làm việc"/);
  assert.match(pageSource, />Trang trước<\/button>/);
  assert.match(pageSource, />Trang sau<\/button>/);
  assert.doesNotMatch(pageSource, /\{sortedSchedules\.map\(\(item\) => \(/, "cards must render from the paginated slice, not the full list");
});

test("branch chip tint is a deterministic pure function of the branch id", () => {
  const first = branchChipTint("branch-alpha-001");
  const second = branchChipTint("branch-beta-002");
  assert.ok(BRANCH_TINTS.includes(first));
  assert.ok(BRANCH_TINTS.includes(second));
  // Stable across repeated calls — the same branch never changes color mid-session.
  assert.equal(branchChipTint("branch-alpha-001"), first);
  assert.equal(branchChipTint("branch-beta-002"), second);
  assert.equal(branchTintIndex("branch-alpha-001"), branchTintIndex("branch-alpha-001"));
  assert.ok(branchTintIndex("") >= 0 && branchTintIndex("") < BRANCH_TINTS.length);
});

test("shift rows are derived from distinct schedule windows and sorted by start", () => {
  const rows = deriveShiftRows([
    fakeSchedule({ startTime: "11:00:00", endTime: "17:00:00" }),
    fakeSchedule({ startTime: "07:00:00", endTime: "11:00:00" }),
    fakeSchedule({ startTime: "07:00:00", endTime: "11:00:00" }),
  ]);
  assert.deepEqual(rows.map((row) => row.key), ["07:00-11:00", "11:00-17:00"]);
});

test("week windowing, effective-range filtering and cell placement are correct", () => {
  // 2026-09-23 is a Wednesday; the window starts at the anchor, not at Monday,
  // so it ends on the following Tuesday (ISO weekday 2).
  const days = weekDaysFrom("2026-09-23");
  assert.equal(days.length, 7);
  assert.equal(days[0].date, "2026-09-23");
  assert.equal(days[0].dayOfWeek, 3);
  assert.equal(days[6].date, "2026-09-29");
  assert.equal(days[6].dayOfWeek, 2);
  assert.equal(addDays("2026-09-23", -7), "2026-09-16");

  const wednesday = fakeSchedule({ dayOfWeek: 3, effectiveFrom: "2026-09-01", effectiveTo: "2026-09-25" });
  assert.ok(scheduleAppliesOnDate(wednesday, "2026-09-23"));
  assert.ok(!scheduleAppliesOnDate(wednesday, "2026-09-30"), "outside the effective range");
  assert.ok(!scheduleAppliesOnDate(wednesday, "2026-09-24"), "wrong weekday");
  assert.deepEqual(schedulesForCell([wednesday], "2026-09-23", "07:00-11:00").map((s) => s.id), [wednesday.id]);
  assert.deepEqual(schedulesForCell([wednesday], "2026-09-23", "11:00-17:00"), []);
});

test("chip labels abbreviate facility prefixes and cap length for tooltips-first chips", () => {
  assert.equal(branchShortName("Phòng khám Đa khoa Sài Gòn"), "PK Đa khoa Sài Gòn");
  assert.equal(branchShortName("Cơ sở 1"), "CS 1");
  const long = branchShortName("Bệnh viện Đa khoa Khu vực Thủ Đức");
  assert.ok(long.startsWith("BV "), `expected abbreviation, got ${long}`);
  assert.ok(long.length <= 24, `chip label must stay compact, got ${long.length}`);
});
