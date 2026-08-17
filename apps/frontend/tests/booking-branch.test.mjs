import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiPath = new URL("../lib/api.ts", import.meta.url);
const typesPath = new URL("../types/hospital.ts", import.meta.url);
const modalPath = new URL("../components/BookingModal.tsx", import.meta.url);

test("slot client carries branch identity and rejects mismatched responses", async () => {
  const [api, types] = await Promise.all([
    readFile(apiPath, "utf8"),
    readFile(typesPath, "utf8"),
  ]);

  assert.match(api, /fetchDoctorSlots\(\s*doctorId: string,\s*branchId: string,\s*date: string/);
  assert.match(api, /new URLSearchParams\(\{ date, branchId \}\)/);
  assert.match(api, /slot\.branchId !== branchId/);
  assert.match(types, /export interface TimeSlot \{[\s\S]*branchId: string;/);
  assert.match(types, /export interface HoldSlotPayload \{[\s\S]*branchId: string;/);
});

test("booking fallback doctors keep the SQL seed identities", async () => {
  const source = await readFile(apiPath, "utf8");

  assert.match(source, /nguyen-minh-khoi/);
  assert.match(source, /tran-thu-ha/);
  assert.match(source, /le-van-duc/);
  assert.match(source, /pham-hoang-yen/);
  assert.doesNotMatch(source, /nguyen-van-an|tran-bich-ngoc|le-hoang-minh|pham-quoc-hung/);
});

test("branch two selection resets slot identity and passes the selected branch to hold", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /const handleBranchChange = \(branchId: string\)/);
  assert.match(source, /SEED_DOCTORS\.find\(\(doctor\) => doctor\.branchId === branchId\)/);
  assert.match(source, /fetchDoctorSlots\(selectedDoctor, selectedBranch, selectedDate\)/);
  assert.match(source, /branchId: selectedBranch/);
  assert.match(source, /chosenSlot\.branchId !== selectedBranch/);
  assert.match(source, /setSelectedSlot\(""\)/);
});

test("booking slot UI exposes loading, error, and empty states", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /role="status"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /Chưa có khung giờ cho bác sĩ/);
});
