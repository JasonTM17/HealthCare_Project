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

test("branch two selection resets slot identity and passes the selected branch to hold", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /const handleBranchChange = \(branchId: string\)/);
  assert.match(source, /doctorWorksAtBranch\(doctor, branchId\)/);
  assert.match(source, /doctor\.branchIds\.includes\(branchId\)/);
  assert.match(source, /doctorTreatsSpecialty\(doctor, nextSpecialty\)/);
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
  assert.match(source, /Thử tải lại khung giờ/);
});

test("booking catalog loads independently and offers a clear retry", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /setCatalogRequest\(\(request\) => request \+ 1\)/);
  assert.match(source, /Danh mục đặt lịch chưa tải đầy đủ/);
  assert.match(source, /Thử tải lại/);
  assert.match(source, /Đang tải cơ sở khám/);
  assert.match(source, /Chọn chuyên khoa cần khám/);
  assert.match(source, /Chọn bác sĩ phù hợp/);
});

test("booking input and OTP validation match the backend contract", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /\^\[\+0-9\(\) \.\-\]\{7,20\}\$/);
  assert.match(source, /Mã OTP phải gồm đúng 6 chữ số/);
  assert.match(source, /autoComplete="one-time-code"/);
  assert.match(source, /secondsRemaining <= 0/);
});

test("booking dialog resets, manages focus, and only closes from the real backdrop", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /dialogRef = useRef<HTMLDivElement>/);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
  assert.match(source, /document\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /previouslyFocused\?\.isConnected/);
  assert.match(source, /dialogRef\.current\?\.focus\(\)/);
  assert.match(source, /event\.target === event\.currentTarget/);
  assert.match(source, /setConfirmedAppointment\(null\)/);
  assert.match(source, /setFullName\(""\)/);
});

test("booking API converts network and server failures to safe Vietnamese messages", async () => {
  const source = await readFile(apiPath, "utf8");

  assert.match(source, /async function fetchBookingApi/);
  assert.match(source, /response\.status >= 500/);
  assert.match(source, /Không thể kết nối với hệ thống đặt lịch/);
  assert.match(source, /Không thể kết nối với hệ thống xác nhận/);
  assert.match(source, /Dữ liệu khung giờ chưa đầy đủ/);
  assert.doesNotMatch(source, /Failed to fetch|NetworkError/);
});

test("booking API aborts stalled requests after twelve seconds and preserves caller cancellation", async () => {
  const source = await readFile(apiPath, "utf8");

  assert.match(source, /BOOKING_REQUEST_TIMEOUT_MS = 12_000/);
  assert.match(source, /const timeoutController = new AbortController\(\)/);
  assert.match(source, /callerSignal\?\.addEventListener\("abort", forwardCallerAbort/);
  assert.match(source, /signal: timeoutController\.signal/);
  assert.match(source, /clearTimeout\(timeoutId\)/);
  assert.match(source, /callerSignal\?\.removeEventListener\("abort", forwardCallerAbort\)/);
});

test("booking dialog uses natural Vietnamese sentence case", async () => {
  const source = await readFile(modalPath, "utf8");

  for (const text of [
    "Hệ thống đặt lịch khám",
    "Chuyên khoa và bác sĩ",
    "Giữ chỗ và nhận mã OTP",
    "Đặt lịch khám thành công",
    "Đóng và về trang chủ",
  ]) {
    assert.match(source, new RegExp(text));
  }
  assert.doesNotMatch(source, /Đặt Lịch Khám Thành Công|Giữ chỗ & Nhận/);
});

test("booking form fields have stable accessible labels and progress state", async () => {
  const source = await readFile(modalPath, "utf8");
  const fieldIds = [
    "booking-branch",
    "booking-specialty",
    "booking-doctor",
    "booking-date",
    "booking-full-name",
    "booking-phone",
    "booking-email",
    "booking-reason",
    "booking-otp",
  ];

  for (const fieldId of fieldIds) {
    assert.match(source, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(source, new RegExp(`id="${fieldId}"`));
  }
  assert.match(source, /aria-current=\{step === 1 \? "step" : undefined\}/);
  assert.match(source, /aria-current=\{step === 4 \? "step" : undefined\}/);
  assert.match(source, /aria-live="assertive"[\s\S]*role="alert"/);
});
