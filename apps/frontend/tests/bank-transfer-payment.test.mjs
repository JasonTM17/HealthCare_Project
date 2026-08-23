import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("bank transfer client keeps patient and admin APIs authenticated", async () => {
  const source = await read("lib/api-client.ts");
  assert.match(source, /export async function fetchBankTransferPayment/);
  assert.match(source, /export async function submitBankTransfer/);
  assert.match(source, /export async function adminListPayments/);
  assert.match(source, /export async function adminReviewPayment/);
  assert.match(source, /getAuthenticatedJson<BankTransferPayment>/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_(?:BANK|PAYMENT)/);
});

test("patient transfer UI warns against credential collection and submits only a reference", async () => {
  const source = await read("app/patient/dashboard/page.tsx");
  assert.match(source, /không bao giờ yêu cầu mã OTP ngân hàng hoặc mật khẩu/);
  assert.match(source, /Nội dung chuyển khoản/);
  assert.match(source, /submitBankTransfer\(payment\.data\.appointmentId, paymentReference\.trim\(\)\)/);
  assert.doesNotMatch(source, /cardNumber|cvv|bankPassword|bankOtp/i);
});

test("patient payment status polling uses cleanup and bounded backoff for unpaid and pending states", async () => {
  const source = await read("app/patient/dashboard/page.tsx");
  assert.match(source, /PAYMENT_POLL_DELAYS/);
  assert.match(source, /UNPAID:\s*\[20_000, 30_000, 45_000, 60_000\]/);
  assert.match(source, /PENDING_VERIFICATION:\s*\[8_000, 12_000, 20_000, 30_000, 45_000, 60_000\]/);
  assert.match(source, /cancelled = true/);
  assert.match(source, /window\.clearTimeout\(timer\)/);
  assert.doesNotMatch(source, /setInterval\(/);
  assert.match(source, /syncAppointmentPaymentStatus\(latest\.appointmentId, latest\.status\)/);
});

test("VietQR download validates its origin, MIME type and maximum payload", async () => {
  const source = await read("app/patient/dashboard/page.tsx");
  assert.match(source, /url\.hostname === "img\.vietqr\.io"/);
  assert.match(source, /credentials: "omit"/);
  assert.match(source, /referrerPolicy: "no-referrer"/);
  assert.match(source, /blob\.type\.startsWith\("image\/"\)/);
  assert.match(source, /MAX_QR_DOWNLOAD_BYTES/);
  assert.match(source, /download = `vietqr-/);
});

test("payment controls expose copy feedback, focus recovery and rejected guidance", async () => {
  const [dashboard, appointments, styles] = await Promise.all([
    read("app/patient/dashboard/page.tsx"),
    read("components/PortalAppointments.tsx"),
    read("app/patient/dashboard/PaymentPanel.module.css"),
  ]);
  assert.match(dashboard, /aria-live="polite"[^>]*role="status">\{copyAnnouncement\}/);
  assert.match(dashboard, /Không chuyển lần thứ hai/i);
  assert.match(dashboard, /document\.getElementById\("appointments-title"\)/);
  assert.match(appointments, /aria-controls="patient-payment-panel"/);
  assert.match(appointments, /aria-expanded=/);
  assert.match(styles, /@media \(max-width: 640px\)/);
});

test("admin reconciliation requires explicit review and is linked in navigation", async () => {
  const [page, layout] = await Promise.all([
    read("app/admin/payments/page.tsx"),
    read("app/admin/layout.tsx"),
  ]);
  assert.match(page, /Chỉ xác nhận sau khi giao dịch xuất hiện trên sao kê/);
  assert.match(page, /"VERIFY"/);
  assert.match(page, /"REJECT"/);
  assert.match(layout, /\/admin\/payments/);
});

test("confirmed booking routes back to the exact claimed appointment payment", async () => {
  const [booking, dashboard] = await Promise.all([
    read("components/BookingModal.tsx"),
    read("app/patient/dashboard/page.tsx"),
  ]);
  assert.match(booking, /paymentAppointmentId=.*confirmedAppointment\.id/);
  assert.match(dashboard, /searchParams\.get\("paymentAppointmentId"\)/);
  assert.match(dashboard, /handleChoosePayment\(target\)/);
  assert.match(dashboard, /đúng email đã nhận OTP/);
});
