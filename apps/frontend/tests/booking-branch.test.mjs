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

test("booking catalog no longer carries frontend seed identities", async () => {
  const source = await readFile(apiPath, "utf8");

  assert.doesNotMatch(source, /SEED_|nguyen-minh-khoi|tran-thu-ha|le-van-duc|pham-hoang-yen/);
});

test("AI specialty identity fails closed when the live booking catalog is stale", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /requestedSpecialtyId/);
  assert.match(source, /requestedSpecialtyId && !requestedSpecialty/);
  assert.match(source, /Chuyên khoa từ trợ lý không còn trong catalog live/);
  assert.match(source, /if \(!currentSpecialty \|\| !selectedSpecialty\)/);
  assert.match(source, /setStep\(1\)/);
  assert.doesNotMatch(source, /specialties\.some\(\(specialty\) => specialty\.id === initialSpecialtyId\)/);
});

test("branch two selection resets slot identity and passes the selected branch to hold", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /const handleBranchChange = \(branchId: string\)/);
  assert.match(source, /doctors\.find\(\(doctor\) =>[\s\S]*doctorMatchesBranch\(doctor, branchId\)/);
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

test("booking UI keeps the server hold and OTP expiries separate", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /const \[otpExpiresAt, setOtpExpiresAt\]/);
  assert.match(source, /setOtpExpiresAt\(result\.otpExpiresAt\)/);
  assert.match(source, /const otpExpired = Boolean/);
  assert.match(source, /if \(otpExpired\)/);
  assert.match(source, /OTP còn hiệu lực/);
});
