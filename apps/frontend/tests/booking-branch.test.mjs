import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiPath = new URL("../lib/api.ts", import.meta.url);
const typesPath = new URL("../types/hospital.ts", import.meta.url);
const modalPath = new URL("../components/BookingModal.tsx", import.meta.url);
const focusPath = new URL("../components/useDialogFocus.ts", import.meta.url);
const privacyPath = new URL("../app/chinh-sach-bao-mat/page.tsx", import.meta.url);

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
  assert.match(source, /Chuyên khoa từ trợ lý không còn trong danh mục hiện tại/);
  assert.match(source, /if \(!currentSpecialty \|\| !selectedSpecialty\)/);
  assert.match(source, /setStep\(1\)/);
  assert.doesNotMatch(source, /specialties\.some\(\(specialty\) => specialty\.id === initialSpecialtyId\)/);
  assert.doesNotMatch(source, /doctors\[0\]/);
});

test("booking keeps a doctor CTA scoped to that doctor's specialty and branch", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /const requestedDoctor = doctors\.find\(\(doctor\) => doctor\.id === initialDoctorId\)/);
  assert.match(source, /specialtyIdForDoctor\(requestedDoctor, specialties\)/);
  assert.match(source, /branches\.find\(\(branch\) => requestedDoctor && doctorMatchesBranch\(requestedDoctor, branch\.id\)\)/);
  assert.match(source, /Chọn bác sĩ thuộc chuyên khoa đã chọn/);
  assert.match(source, /currentSpecialty\?\.name \|\| doc\.title/);
});

test("branch two selection resets slot identity and passes the selected branch to hold", async () => {
  const source = await readFile(modalPath, "utf8");
  const branchHandler = source.slice(
    source.indexOf("const handleBranchChange"),
    source.indexOf("const handleDoctorChange"),
  );

  assert.match(source, /const handleBranchChange = \(branchId: string\)/);
  assert.match(source, /if \(branchId === selectedBranch\) return/);
  assert.match(source, /doctors\.find\(\(doctor\) =>[\s\S]*doctorMatchesBranch\(doctor, branchId\)/);
  assert.match(source, /doctor\.branchIds\.includes\(branchId\)/);
  assert.match(source, /doctorMatchesSpecialty\(doctor, currentSpecialty\)/);
  assert.match(source, /fetchDoctorSlots\([\s\S]*slotQueryIdentity\.doctorId,[\s\S]*slotQueryIdentity\.branchId,[\s\S]*slotQueryIdentity\.date,[\s\S]*signal/);
  assert.match(source, /normalizeBookingSlotQueryIdentity\(selectedDoctor, selectedBranch, selectedDate\)/);
  assert.match(source, /branchId: selectedBranch/);
  assert.match(source, /chosenSlot\.branchId !== selectedBranch/);
  assert.doesNotMatch(branchHandler, /setSlots|setSlotQueryState|setSelectedSlot/);
});

test("booking invalidates pending responses across navigation and labels patient fields", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /bookingSessionRef/);
  assert.match(source, /invalidateBookingSession/);
  assert.match(source, /navigateToStep/);
  assert.match(source, /disabled=\{isSubmitting\}/);
  for (const field of ["booking-full-name", "booking-phone", "booking-email", "booking-reason", "booking-has-insurance", "booking-privacy-consent", "booking-otp"]) {
    assert.match(source, new RegExp(field));
  }
});

test("booking captures BHYT and privacy consent before holding a slot", async () => {
  const [source, types, privacy] = await Promise.all([
    readFile(modalPath, "utf8"),
    readFile(typesPath, "utf8"),
    readFile(privacyPath, "utf8"),
  ]);

  assert.match(types, /hasInsurance\?: boolean/);
  assert.match(types, /privacyConsent: boolean/);
  assert.match(types, /hasInsurance: boolean/);
  assert.match(types, /privacyConsentAt\?: string \| null/);
  assert.match(source, /const \[hasInsurance, setHasInsurance\] = useState<boolean>\(false\)/);
  assert.match(source, /const \[privacyConsent, setPrivacyConsent\] = useState<boolean>\(false\)/);
  assert.match(source, /if \(!privacyConsent\)/);
  assert.match(source, /hasInsurance,/);
  assert.match(source, /privacyConsent,/);
  assert.match(source, /href="\/chinh-sach-bao-mat"/);
  assert.match(source, /Mang theo thẻ BHYT/);
  assert.match(source, /booking-privacy-consent/);
  assert.match(privacy, /booking-privacy-v1/);
  assert.match(privacy, /PublicPageShell/);
  assert.match(privacy, /Thông tin chúng tôi thu thập/);
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
  assert.match(source, /Đang tải thông tin bác sĩ, chuyên khoa và cơ sở/);
  assert.match(source, /Chọn chuyên khoa cần khám/);
  assert.match(source, /disabled=\{isSubmitting \|\| catalogLoading \|\| !currentDoctor\}/);
});

test("booking input and OTP validation match the backend contract", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /\^\[\+0-9\(\) \.\-\]\{7,20\}\$/);
  assert.match(source, /Mã OTP phải gồm đúng 6 chữ số/);
  assert.match(source, /autoComplete="one-time-code"/);
  assert.match(source, /secondsRemaining <= 0/);
});

test("branch booking CTAs reflect the live doctor-assignment gate", async () => {
  const [detail, list, booking, home, types] = await Promise.all([
    readFile(new URL("../app/branches/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/branches/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dat-lich/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(typesPath, "utf8"),
  ]);

  assert.match(types, /activeDoctorCount\?: number/);
  assert.match(detail, /onlineBookingAvailable/);
  assert.match(detail, /Cơ sở này chưa có bác sĩ được gán lịch trực tuyến/);
  assert.match(detail, /Liên hệ để xác nhận lịch/);
  assert.match(detail, /Đặt lịch ở cơ sở khác/);
  for (const source of [list, booking, home]) {
    assert.match(source, /activeDoctorCount === 0/);
    assert.match(source, /Xem tình trạng lịch/);
  }
});

test("booking UI keeps the server hold and OTP expiries separate", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /const \[otpExpiresAt, setOtpExpiresAt\]/);
  assert.match(source, /setOtpExpiresAt\(result\.otpExpiresAt\)/);
  assert.match(source, /const otpExpired = Boolean/);
  assert.match(source, /if \(otpExpired\)/);
  assert.match(source, /OTP còn hiệu lực/);
});

test("booking dialog resets, manages focus, and only closes from the real backdrop", async () => {
  const [source, focus] = await Promise.all([
    readFile(modalPath, "utf8"),
    readFile(focusPath, "utf8"),
  ]);

  assert.match(source, /dialogRef = useRef<HTMLDivElement>/);
  assert.match(source, /useDialogFocus\(dialogRef, active && isModal, closePresentation\)/);
  assert.match(focus, /document\.body\.style\.overflow = "hidden"/);
  assert.match(focus, /document\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(focus, /event\.key === "Escape"/);
  assert.match(focus, /previouslyFocused\?\.isConnected/);
  assert.match(focus, /\(first \?\? dialog\)\.focus\(\)/);
  assert.match(source, /event\.target === event\.currentTarget/);
  assert.match(source, /setConfirmedAppointment\(null\)/);
  assert.match(source, /setFullName\(""\)/);
});

test("booking steps announce themselves and slot selection is not colour-only", async () => {
  const source = await readFile(modalPath, "utf8");

  // Every one of the seven steps focuses its own heading after the transition.
  assert.match(source, /const stepHeadingRef = useRef<HTMLHeadingElement \| null>\(null\)/);
  assert.match(source, /const lastFocusedStepRef = useRef<number>\(step\)/);
  assert.match(source, /if \(lastFocusedStepRef\.current === step\) return/);
  assert.match(source, /stepHeadingRef\.current\?\.focus\(\)/);
  const headingTargets = source.match(/ref=\{stepHeadingRef\} tabIndex=\{-1\}/g) ?? [];
  assert.equal(headingTargets.length, 7, "each booking step heading must be a focus target");

  // Selection carries a pressed state and a text alternative, not just colour.
  assert.match(source, /aria-pressed=\{isSelected\}/);
  assert.match(source, /<span className="sr-only">Đã chọn<\/span>/);
  assert.match(source, /aria-labelledby="booking-slot-label"/);
});

test("booking slot duration comes from the selected slot instead of a fixed label", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /const selectedSlotMinutes = bookingSlotMinutes\(selectedSlotDetail\)/);
  assert.match(source, /function bookingSlotMinutes\(slot\?: TimeSlot\): number \| null/);
  assert.match(source, /end === null \|\| end <= start/);
  assert.match(source, /"Khung giờ khám"/);
  assert.match(source, /`Khung giờ khám \(\$\{selectedSlotMinutes\} phút\/lượt\)`/);
  assert.doesNotMatch(source, /30 phút\/lượt/);
});

test("booking error banner lives in the scrollable step body and describes step 6 inputs", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /id="booking-error-message"/);
  assert.match(source, /ref=\{errorBannerRef\}/);
  assert.match(source, /errorBannerRef\.current\?\.scrollIntoView\(\{ block: "nearest" \}\)/);
  assert.match(source, /const step6ErrorId = step === 6 && errorMessage \? "booking-error-message" : ""/);
  assert.equal(
    (source.match(/aria-invalid=\{step6ErrorId \? true : undefined\}/g) ?? []).length,
    6,
    "every step-6 input must be marked invalid while the form-level error is shown",
  );
  assert.match(source, /aria-describedby=\{step6ErrorId \? `booking-email-help \$\{step6ErrorId\}` : "booking-email-help"\}/);
  // The banner must render inside the body (which is the scrolling container in the modal).
  const bodyIndex = source.indexOf('<div className={bodyClassName}>');
  const bannerIndex = source.indexOf('id="booking-error-message"');
  assert.ok(bodyIndex >= 0 && bannerIndex > bodyIndex, "banner must sit inside the step body");
});

test("booking modal keeps its header reachable on phones", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /max-h-\[92dvh\]/);
  assert.match(source, /className="dialog-layer fixed inset-0 flex items-center justify-center p-2 sm:p-4 animate-fadeIn"/);
});

test("hold requests carry one idempotency key across their single retry", async () => {
  const source = await readFile(apiPath, "utf8");

  assert.match(source, /import \{ randomId \} from "\.\/secure-random"/);
  assert.match(source, /const idempotencyKey = holdIdempotencyKey\(\)/);
  assert.match(source, /\.\.\.\(idempotencyKey \? \{ "Idempotency-Key": idempotencyKey \} : \{\}\)/);
  assert.match(source, /\^\[A-Za-z0-9\._:-\]\{8,128\}\$/);
  // The retry loop reuses requestInit, so both attempts share the same key.
  assert.match(source, /for \(let attempt = 0; attempt < 2; attempt\+\+\)[\s\S]*fetchBookingApi\(requestUrl, requestInit, networkMessage\)/);
});

test("booking page reuses the engine inline without mounting a second dialog", async () => {
  const [source, shell, route] = await Promise.all([
    readFile(modalPath, "utf8"),
    readFile(new URL("../components/PublicPageShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dat-lich/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(source, /function BookingExperience/);
  assert.match(source, /presentation: "modal" \| "inline"/);
  assert.match(source, /export function BookingInlineExperience/);
  assert.match(source, /if \(!isModal\) return panel/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /min=\{minimumAppointmentDate\}/);
  assert.doesNotMatch(source, /min=\{selectedDate\}/);
  assert.match(shell, /onBookingRequest\?: \(selection\?: BookingSelection\) => void/);
  assert.match(shell, /if \(onBookingRequest\)/);
  assert.match(shell, /!onBookingRequest && bookingOpen/);
  assert.match(route, /<PublicPageShell onBookingRequest=\{handleBookingRequest\}>/);
  assert.match(route, /Các cơ sở khám nổi bật/);
  assert.match(route, /fetchBranches\(0, 6\)/);
  assert.match(route, /Đặt lịch hẹn/);
  assert.match(route, /<BookingInlineExperience key=\{bookingRequest\.nonce\} selection=\{bookingRequest\.selection\} \/>/);
  assert.match(route, /bookingRegionRef\.current\?\.scrollIntoView/);
  assert.doesNotMatch(route, /bookingInitiallyOpen/);
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

  assert.match(source, /BOOKING_REQUEST_TIMEOUT_MS = 28_000/);
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
    "Chuyên khoa",
    "Cơ sở",
    "Bác sĩ",
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
    "booking-has-insurance",
    "booking-privacy-consent",
    "booking-otp",
  ];

  for (const fieldId of fieldIds) {
    assert.match(source, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(source, new RegExp(`id="${fieldId}"`));
  }
  assert.match(source, /const BOOKING_STEPS = \[[\s\S]*\{ id: 7, label: "Xác nhận" \}/);
  assert.match(source, /const BOOKING_STAGES = \[[\s\S]*Xác nhận OTP/);
  assert.match(source, /aria-current=\{current \? "step" : undefined\}/);
  assert.match(source, /aria-live="assertive"[\s\S]*role="alert"/);
});
