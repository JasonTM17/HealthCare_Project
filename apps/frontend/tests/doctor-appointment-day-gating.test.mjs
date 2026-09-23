import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Round-10 matrix finding: the doctor dashboard offered "Tiếp nhận"/"Không
 * đến" on every CONFIRMED row, including future-dated ones the backend
 * refuses with 409 (check-in is same-day only; no-show only after the visit
 * window ends). These assertions pin the day-scoped gating so a future
 * refactor cannot silently re-offer refused actions.
 */
const source = () => readFile(new URL("../components/PortalAppointments.tsx", import.meta.url), "utf8");

test("doctor appointment actions are gated on the business day", async () => {
  const component = await source();

  assert.match(component, /const today = businessDate\(\)/);
  assert.match(
    component,
    /appointment\.appointmentDate === today \? \([\s\S]*CHECKED_IN[\s\S]*NO_SHOW[\s\S]*\) : appointment\.appointmentDate < today \? \([\s\S]*NO_SHOW[\s\S]*\) : \([\s\S]*Chỉ thao tác được trong ngày khám/,
    "future CONFIRMED rows must render the day-scope note instead of refused actions",
  );
  // "Không đến" appears exactly three times in the doctor branch: once in the
  // today-gated CONFIRMED row, once in the past-day CONFIRMED row, and once on
  // CHECKED_IN rows (which can only exist on their own day). A fourth
  // occurrence would mean an ungated copy crept back in.
  const noshowOccurrences = component.match(/onUpdateStatus\(appointment, "NO_SHOW"\)/g) ?? [];
  assert.equal(noshowOccurrences.length, 3, "NO_SHOW must stay confined to the day-gated branches");
});
