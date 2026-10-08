import assert from "node:assert/strict";
import { after, before, test as nodeTest } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.PACKAGE_BOOKING_SOURCE_ROOT ?? frontendRoot;
const sources = {};
for (const [name, file] of [
  ["react", "react/cjs/react.development.js"],
  ["react/jsx-runtime", "react/cjs/react-jsx-runtime.development.js"],
  ["react-dom", "react-dom/cjs/react-dom.development.js"],
  ["react-dom/client", "react-dom/cjs/react-dom-client.development.js"],
  ["scheduler", "scheduler/cjs/scheduler.development.js"],
]) {
  const packageName = file.split("/")[0];
  sources[name] = readFileSync(path.join(path.dirname(require.resolve(packageName)), file.slice(packageName.length + 1)), "utf8");
}

function addComponent(relative) {
  if (sources[relative]) return;
  const filename = path.join(sourceRoot, relative);
  let compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  compiled = compiled.replace(/require\("([^"]+)"\)/g, (original, specifier) => {
    if (!specifier.startsWith(".")) return original;
    if (specifier.endsWith(".css")) return 'require("fixture-css")';
    for (const [suffix, stub] of [
      ["api-client", "fixture-api"], ["lib/api", "fixture-booking-api"],
      ["UiIcon", "fixture-icon"], ["types/hospital", "fixture-types"],
    ]) if (specifier.endsWith(suffix)) return `require(${JSON.stringify(stub)})`;
    const target = path.resolve(path.dirname(filename), specifier);
    const resolved = [target + ".tsx", target + ".ts"].find(existsSync);
    assert.ok(resolved, `fixture dependency not mapped: ${specifier}`);
    const dependency = path.relative(sourceRoot, resolved).replaceAll("\\", "/");
    addComponent(dependency);
    return `require(${JSON.stringify(dependency)})`;
  });
  sources[relative] = compiled;
}
addComponent("components/PackageBookingModal.tsx");

const fixture = `
globalThis.process = { env: { NODE_ENV: "development" } };
const sources = ${JSON.stringify(sources)};
const cache = {};
const stubs = {};
function require(name) {
  if (stubs[name]) return stubs[name];
  if (cache[name]) return cache[name].exports;
  if (!sources[name]) throw new Error("Unmapped fixture module: " + name);
  const mod = { exports: {} }; cache[name] = mod;
  new Function("require", "module", "exports", sources[name])(require, mod, mod.exports);
  return mod.exports;
}
const React = require("react");
const ReactDOM = require("react-dom");
const root = require("react-dom/client").createRoot(document.getElementById("root"));
class ApiError extends Error {
  constructor(message, status, endpoint, payload) {
    super(message); this.status = status; this.endpoint = endpoint; this.code = payload?.code; this.fieldErrors = payload?.fieldErrors ?? {};
  }
}
const BRANCH = {
  id: "br-1", name: "Cơ sở Test", slug: "co-so-test", address: "1 Đường Test",
  workingHours: "07:30 - 17:00",
  doctors: [{ id: "doc-1", fullName: "BS Tiếp Nhận", slug: "bs-tiep-nhan" }],
};
const PKG = { id: "pkg-1", name: "Gói khám tổng quát", slug: "goi-tong-quat", description: "", price: 1500000, preparationSteps: ["Nhịn ăn sáng"] };
const SLOT = { branchId: "br-1", startTime: "08:00:00", endTime: "08:30:00", available: true, statusNote: "Còn trống" };
const control = window.pkgFixture = {
  open: true, closed: 0,
  holds: [], confirms: [], cancels: [], resends: [],
  slotCalls: 0,
  holdMode: "resolve", confirmMode: "resolve", cancelMode: "resolve",
  resolveHold: null, resolveConfirm: null, rejectConfirm: null,
  resolveCancel: null, rejectCancel: null,
};
function holdResult(bookingCode) {
  return {
    bookingCode: bookingCode || "APT-PKG-1",
    holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    otpExpiresAt: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
    otpDeliveryStatus: "SENT",
  };
}
stubs["fixture-booking-api"] = {
  fetchDoctorSlots: async (doctorId, branchId, date, signal) => {
    control.slotCalls += 1;
    return [SLOT];
  },
  holdAppointmentSlot: (payload) => {
    control.holds.push(structuredClone(payload));
    if (control.holdMode === "deferred") {
      return new Promise((resolve, reject) => {
        control.resolveHold = resolve;
        control.rejectHold = reject;
      });
    }
    return Promise.resolve(holdResult());
  },
  confirmAppointment: (payload) => {
    control.confirms.push(structuredClone(payload));
    if (control.confirmMode === "deferred") {
      return new Promise((resolve, reject) => {
        control.resolveConfirm = resolve;
        control.rejectConfirm = reject;
      });
    }
    if (control.confirmMode === "reject") return Promise.reject(new Error("Không thể kết nối đến hệ thống xác nhận. Vui lòng thử lại."));
    return Promise.resolve(confirmResult(payload.bookingCode));
  },
};
function confirmResult(bookingCode) {
  return {
    id: "appt-fixture-1",
    bookingCode,
    patientName: "Nguyễn Thị Test",
    patientPhone: "0901234567",
    appointmentDate: "2030-01-15",
    startTime: "08:00:00",
    endTime: "08:30:00",
    branchName: "Cơ sở Test",
  };
}
stubs["fixture-api"] = {
  ApiError,
  fetchBranches: async () => ({ content: [BRANCH] }),
  fetchDoctors: async () => ({ content: [] }),
  getAuthSessionSnapshot: () => null,
  resendAppointmentOtp: async (bookingCode, phone, signal) => {
    control.resends.push({ bookingCode, phone });
    return { ...holdResult(bookingCode), retryAfterSeconds: 60 };
  },
  cancelPatientAppointment: (bookingCode, reason, options) => {
    control.cancels.push({
      bookingCode,
      reason,
      options: options ? structuredClone(options) : options,
    });
    if (control.cancelMode === "deferred") {
      return new Promise((resolve, reject) => {
        control.resolveCancel = resolve;
        control.rejectCancel = reject;
      });
    }
    if (control.cancelMode === "reject") return Promise.reject(new Error("release failed"));
    return Promise.resolve({ bookingCode });
  },
};
stubs["fixture-icon"] = { __esModule: true, default: (props) => React.createElement("span", { "data-icon": props.name }) };
stubs["fixture-types"] = {};
stubs["fixture-css"] = {};
stubs["next/link"] = { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
control.render = () => {
  const Modal = require("components/PackageBookingModal.tsx").default;
  ReactDOM.flushSync(() => root.render(React.createElement(Modal, {
    isOpen: control.open,
    onClose: () => { control.closed += 1; control.open = false; control.render(); },
    packageItem: PKG,
    branches: [BRANCH],
  })));
};
control.unmount = () => {
  ReactDOM.flushSync(() => root.render(null));
};
control.getCancels = () => control.cancels;
`;

const hasChromium = existsSync(chromium.executablePath());
let browser;
before(async () => {
  if (!hasChromium) return;
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  if (browser) await browser.close();
});

const test = (name, fn) => nodeTest(name, { skip: !hasChromium ? "Playwright Chromium not installed" : false }, fn);

async function mount(setup = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>');
  // The fixture has no stylesheet, so give the dialog layer the geometry a
  // real backdrop has: without padding, the panel fills the layer edge-to-edge
  // and a click at the layer's corner lands on the panel, never the backdrop.
  await page.addStyleTag({
    content: ".dialog-layer{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding:16px;box-sizing:border-box;overflow-y:auto}.booking-panel{position:relative;width:100%;max-width:640px;margin:auto 0}",
  });
  await page.addScriptTag({ content: fixture });
  await page.evaluate((setup) => { Object.assign(pkgFixture, setup); pkgFixture.render(); }, setup);
  await page.locator(".booking-panel").waitFor();
  return { page, errors };
}

const RELEASE_REASON = "Bệnh nhân rời luồng đặt lịch trước khi xác nhận";

async function reachOtpStep(page) {
  await page.getByRole("button", { name: /Tiếp tục: Chọn ngày/ }).click();
  await page.waitForFunction(() => pkgFixture.slotCalls > 0);
  await page.getByRole("button", { name: /Tiếp tục: Điền thông tin/ }).click();
  await page.locator("#package-patient-name").fill("Nguyễn Thị Test");
  await page.locator("#package-patient-phone").fill("0901234567");
  await page.locator("#package-patient-email").fill("tester@example.test");
  await page.locator('input[type="checkbox"][required]').check();
  await page.getByRole("button", { name: /Giữ chỗ và nhận mã OTP/ }).click();
  await page.waitForFunction(() => pkgFixture.holds.length === 1);
  await page.locator("#package-booking-otp").waitFor();
}

async function submitOtp(page) {
  await page.locator("#package-booking-otp").fill("123456");
  await page.getByRole("button", { name: /Hoàn tất đặt lịch khám/ }).click();
}

async function cancelCalls(page) {
  return page.evaluate(() => pkgFixture.cancels.map((c) => ({
    bookingCode: c.bookingCode, reason: c.reason, options: c.options,
  })));
}

function assertPendingOnlyRelease(calls, count = 1) {
  assert.equal(calls.length, count, `expected ${count} cancel call(s), got ${calls.length}`);
  for (const call of calls) {
    assert.equal(call.bookingCode, "APT-PKG-1");
    assert.equal(call.reason, RELEASE_REASON);
    assert.equal(call.options?.phone, "0901234567", "release must present the phone captured at hold time");
    assert.equal(call.options?.pendingOnly, true, "automatic release must be pendingOnly");
  }
}

test("package booking: close button releases the held slot exactly once with pendingOnly", async () => {
  const { page, errors } = await mount();
  try {
    await reachOtpStep(page);
    await page.locator('button[aria-label="Đóng cửa sổ đặt lịch"]').click();
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    assertPendingOnlyRelease(await cancelCalls(page));
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("package booking: backdrop close releases the held slot exactly once", async () => {
  const { page } = await mount();
  try {
    await reachOtpStep(page);
    await page.locator(".dialog-layer").click({ position: { x: 2, y: 2 } });
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    assertPendingOnlyRelease(await cancelCalls(page));
  } finally { await page.close(); }
});

test("package booking: Escape releases the held slot exactly once", async () => {
  const { page } = await mount();
  try {
    await reachOtpStep(page);
    await page.locator("#package-booking-otp").click();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    assertPendingOnlyRelease(await cancelCalls(page));
    assert.equal(await page.evaluate(() => pkgFixture.closed), 1);
  } finally { await page.close(); }
});

test("package booking: external isOpen=false releases the held slot exactly once", async () => {
  const { page } = await mount();
  try {
    await reachOtpStep(page);
    await page.evaluate(() => { pkgFixture.open = false; pkgFixture.render(); });
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    assertPendingOnlyRelease(await cancelCalls(page));
  } finally { await page.close(); }
});

test("package booking: unmount releases the held slot exactly once", async () => {
  const { page } = await mount();
  try {
    await reachOtpStep(page);
    await page.evaluate(() => pkgFixture.unmount());
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    assertPendingOnlyRelease(await cancelCalls(page));
  } finally { await page.close(); }
});

test("package booking: OTP 'Sửa thông tin' releases the hold and returns to step 3", async () => {
  const { page } = await mount();
  try {
    await reachOtpStep(page);
    await page.getByRole("button", { name: /Sửa thông tin/ }).click();
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    assertPendingOnlyRelease(await cancelCalls(page));
    await page.locator("#package-patient-name").waitFor();
    assert.equal(await page.locator("#package-booking-otp").count(), 0, "OTP screen must be gone after edit-information");
  } finally { await page.close(); }
});

test("package booking: confirmed appointment then close and unmount never cancels", async () => {
  const { page } = await mount();
  try {
    await reachOtpStep(page);
    await submitOtp(page);
    await page.waitForFunction(() => pkgFixture.confirms.length === 1);
    await page.getByText("Đặt Lịch Gói Khám Thành Công", { exact: false }).waitFor();
    await page.getByRole("button", { name: /Hoàn tất & Đóng/ }).click();
    await page.evaluate(() => pkgFixture.unmount());
    await page.waitForTimeout(300);
    assert.equal((await cancelCalls(page)).length, 0, "a confirmed booking must never be auto-cancelled");
  } finally { await page.close(); }
});

test("package booking: a late hold resolution after close releases only that orphan hold", async () => {
  const { page } = await mount({ holdMode: "deferred" });
  try {
    await page.getByRole("button", { name: /Tiếp tục: Chọn ngày/ }).click();
    await page.waitForFunction(() => pkgFixture.slotCalls > 0);
    await page.getByRole("button", { name: /Tiếp tục: Điền thông tin/ }).click();
    await page.locator("#package-patient-name").fill("Nguyễn Thị Test");
    await page.locator("#package-patient-phone").fill("0901234567");
    await page.locator("#package-patient-email").fill("tester@example.test");
    await page.locator('input[type="checkbox"][required]').check();
    await page.getByRole("button", { name: /Giữ chỗ và nhận mã OTP/ }).click();
    await page.waitForFunction(() => pkgFixture.holds.length === 1);
    // Abandon while the hold request is still in flight.
    await page.locator('button[aria-label="Đóng cửa sổ đặt lịch"]').click();
    await page.waitForFunction(() => pkgFixture.closed === 1);
    assert.equal((await cancelCalls(page)).length, 0, "nothing to release before the hold resolves");
    // The hold lands after abandonment: it must be released as an orphan and
    // must not resurrect the OTP step on the closed modal.
    await page.evaluate(() => pkgFixture.resolveHold({
      bookingCode: "APT-LATE-1",
      holdExpiresAt: new Date(Date.now() + 600000).toISOString(),
      otpExpiresAt: new Date(Date.now() + 480000).toISOString(),
      otpDeliveryStatus: "SENT",
    }));
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    const calls = await cancelCalls(page);
    assert.equal(calls[0].bookingCode, "APT-LATE-1");
    assert.equal(calls[0].reason, RELEASE_REASON);
    assert.equal(calls[0].options?.phone, "0901234567");
    assert.equal(calls[0].options?.pendingOnly, true);
    assert.equal(await page.locator("#package-booking-otp").count(), 0);
  } finally { await page.close(); }
});

test("package booking: duplicate abandonment (close then unmount) sends one cancel per code", async () => {
  const { page } = await mount();
  try {
    await reachOtpStep(page);
    await page.locator('button[aria-label="Đóng cửa sổ đặt lịch"]').click();
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    await page.evaluate(() => pkgFixture.unmount());
    await page.waitForTimeout(300);
    assertPendingOnlyRelease(await cancelCalls(page), 1);
  } finally { await page.close(); }
});

test("package booking: a failed release keeps intent and retries on a later abandon", async () => {
  const { page } = await mount({ cancelMode: "reject" });
  try {
    await reachOtpStep(page);
    await page.evaluate(() => { pkgFixture.open = false; pkgFixture.render(); });
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    // The release was rejected: intent stays, so a later abandon retries.
    await page.evaluate(() => pkgFixture.unmount());
    await page.waitForFunction(() => pkgFixture.cancels.length === 2);
    const calls = await cancelCalls(page);
    assert.equal(calls[0].bookingCode, "APT-PKG-1");
    assert.equal(calls[1].bookingCode, "APT-PKG-1");
  } finally { await page.close(); }
});

test("package booking: confirmation in flight + close + success never cancels", async () => {
  const { page } = await mount({ confirmMode: "deferred" });
  try {
    await reachOtpStep(page);
    await submitOtp(page);
    await page.waitForFunction(() => pkgFixture.confirms.length === 1);
    await page.locator('button[aria-label="Đóng cửa sổ đặt lịch"]').click();
    await page.waitForFunction(() => pkgFixture.closed === 1);
    // The confirm commits after the modal closed: the booking is real and the
    // stale close path must not release it.
    await page.evaluate(() => pkgFixture.resolveConfirm({
      id: "appt-fixture-1", bookingCode: "APT-PKG-1", patientName: "Người Test",
      appointmentDate: "2030-01-15", startTime: "08:00:00", endTime: "08:30:00",
    }));
    await page.waitForTimeout(300);
    assert.equal((await cancelCalls(page)).length, 0);
  } finally { await page.close(); }
});

test("package booking: confirmation in flight + abandon + failure releases the pending hold", async () => {
  const { page } = await mount({ confirmMode: "deferred" });
  try {
    await reachOtpStep(page);
    await submitOtp(page);
    await page.waitForFunction(() => pkgFixture.confirms.length === 1);
    await page.locator('button[aria-label="Đóng cửa sổ đặt lịch"]').click();
    await page.waitForFunction(() => pkgFixture.closed === 1);
    await page.evaluate(() => pkgFixture.rejectConfirm(new Error("Không thể kết nối đến hệ thống xác nhận.")));
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    assertPendingOnlyRelease(await cancelCalls(page));
  } finally { await page.close(); }
});

test("package booking: a closed-then-reopened retained instance starts clean at step 1", async () => {
  const { page } = await mount();
  try {
    await reachOtpStep(page);
    await page.locator('button[aria-label="Đóng cửa sổ đặt lịch"]').click();
    await page.waitForFunction(() => pkgFixture.cancels.length === 1);
    await page.evaluate(() => { pkgFixture.open = true; pkgFixture.render(); });
    await page.getByText("Bước 1 / 4", { exact: false }).waitFor();
    assert.equal(await page.locator("#package-booking-otp").count(), 0);
  } finally { await page.close(); }
});
