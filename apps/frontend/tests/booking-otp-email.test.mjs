import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modalPath = new URL("../components/BookingModal.tsx", import.meta.url);
const apiPath = new URL("../lib/api-client.ts", import.meta.url);
const typesPath = new URL("../types/hospital.ts", import.meta.url);

test("booking OTP resend is an idempotent existing-hold action", async () => {
  const [modal, api, types] = await Promise.all([
    readFile(modalPath, "utf8"),
    readFile(apiPath, "utf8"),
    readFile(typesPath, "utf8"),
  ]);

  assert.match(api, /\/appointments\/\$\{encodeURIComponent\(normalizedBookingCode\)\}\/otp\/resend/);
  assert.match(api, /method: "POST"/);
  assert.match(api, /retryAfterSeconds/);
  assert.match(modal, /resendAppointmentOtp\(bookingCode, phone, controller\.signal\)/);
  assert.match(modal, /otpResendControllerRef\.current\?\.abort\(\)/);
  assert.match(modal, /otpResendAttemptRef/);
  assert.match(modal, /Không tạo thêm lịch hẹn/);
  assert.match(modal, /Gửi lại mã OTP/);
  assert.match(modal, /otpDeliveryStatus\s*\?\?\s*"QUEUED"/);
  assert.match(types, /export interface HoldSlotResult \{[\s\S]*otpDeliveryStatus\?:/);
});

test("expired OTP can be resent while the hold is alive", async () => {
  const source = await readFile(modalPath, "utf8");
  const handler = source.slice(source.indexOf("const handleResendOtp"), source.indexOf("// Handle Step 4"));
  assert.doesNotMatch(handler, /if \([\s\S]*otpExpired/);
  assert.match(source, /otpExpired && !holdExpired/);
  assert.match(source, /onClick=\{\(\) => void handleResendOtp\(\)\}/);
});
