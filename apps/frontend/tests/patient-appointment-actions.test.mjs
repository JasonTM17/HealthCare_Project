import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const requireFromTest = createRequire(import.meta.url);
const ts = requireFromTest("typescript");
const { isValidElement } = requireFromTest("react");
const { renderToStaticMarkup } = requireFromTest("react-dom/server");

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: path,
  }).outputText;
}

const componentCode = compile("../components/PortalAppointments.tsx");
const businessTimeCode = compile("../lib/business-time.ts");
const calendarCode = compile("../lib/appointment-calendar.ts");

function load(code, modules, date) {
  const runtimeModule = { exports: {} };
  vm.runInNewContext(code, {
    exports: runtimeModule.exports,
    module: runtimeModule,
    Date: date,
    URLSearchParams,
    require(specifier) {
      if (specifier in modules) return modules[specifier];
      throw new Error(`Unexpected test dependency: ${specifier}`);
    },
  });
  return runtimeModule.exports;
}

function nodes(element) {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!isValidElement(element)) return [];
  return [element, ...nodes(element.props.children)];
}

function text(element) {
  if (Array.isArray(element)) return element.map(text).join("");
  if (isValidElement(element)) return text(element.props.children);
  return typeof element === "string" || typeof element === "number" ? String(element) : "";
}

const PATIENT_APPOINTMENT = {
  id: "fixture-appointment",
  bookingCode: "APT-2026-HC02",
  doctorId: "fixture-doctor",
  doctorName: "Bác sĩ Giả Lập",
  specialtyName: "Chuyên khoa Giả Lập",
  branchName: "Cơ sở Giả Lập",
  packageName: "Gói khám Giả Lập",
  appointmentDate: "2026-09-22",
  startTime: "09:00:00",
  endTime: "09:30:00",
  status: "CONFIRMED",
  paymentStatus: "UNPAID",
};

function renderAppointment(now, changes = {}, viewer = "patient") {
  const fixedNow = Date.parse(now);
  class FixedDate extends Date {
    constructor(...values) {
      super(...(values.length ? values : [fixedNow]));
    }
    static now() { return fixedNow; }
  }
  const businessTime = load(businessTimeCode, {}, FixedDate);
  const calendar = load(calendarCode, {}, FixedDate);
  const calls = { cancel: [], reschedule: [], payment: [], download: [], doctor: [] };
  const { default: PortalAppointments } = load(componentCode, {
    "react/jsx-runtime": requireFromTest("react/jsx-runtime"),
    "../lib/business-time": businessTime,
    "../lib/appointment-calendar": {
      ...calendar,
      downloadIcsFile: (appointment) => calls.download.push(appointment),
    },
  }, FixedDate);
  const appointment = { ...PATIENT_APPOINTMENT, ...changes };
  if (viewer === "doctor") {
    delete appointment.doctorId;
    appointment.patientId = "fixture-patient";
    appointment.patientName = "Người Khám Giả Lập";
  }
  const props = {
    page: { content: [appointment], number: 0, totalPages: 1, totalElements: 1 },
    viewer,
    ...(viewer === "patient" ? {
      onCancel: (item) => calls.cancel.push(item),
      onReschedule: (item) => calls.reschedule.push(item),
      onPayment: (item) => calls.payment.push(item),
      activePaymentAppointmentId: appointment.id,
    } : {
      onUpdateStatus: (item, status) => calls.doctor.push({ item, status }),
    }),
  };
  // The real JSX and imported date/calendar modules run here. API mutations
  // and .ics downloads are recorded callbacks, never network/host operations.
  const element = PortalAppointments(props);
  return {
    appointment,
    calls,
    html: renderToStaticMarkup(element),
    elements: nodes(element),
    action(label) {
      return nodes(element).find((node) => node.type === "button" && text(node) === label);
    },
  };
}

function assertSelfActions(result, allowed, cancellableOnly = false) {
  for (const label of cancellableOnly ? ["Hủy lịch"] : ["Đổi lịch", "Hủy lịch"]) {
    const action = result.action(label);
    assert.equal(Boolean(action && action.props.disabled !== true), allowed, `${label} availability at scheduled-start boundary`);
    if (allowed) action.props.onClick();
  }
  if (allowed) {
    assert.equal(result.calls.cancel[0], result.appointment);
    if (!cancellableOnly) assert.equal(result.calls.reschedule[0], result.appointment);
  } else {
    assert.equal(result.calls.cancel.length, 0);
    assert.equal(result.calls.reschedule.length, 0);
    assert.ok(text(result.elements).includes("Đã qua giờ hẹn"), "started visits need a concise explanation");
    const contact = result.elements.find((node) => node.type === "a" && node.props.href === "/contact");
    assert.ok(contact, "started visits need an actual hospital-contact recovery link");
  }
}

test("the observed past CONFIRMED appointment has contact recovery instead of impossible self-actions", () => {
  assertSelfActions(renderAppointment("2026-10-01T06:24:00Z"), false);
});

test("a past PENDING_CONFIRMATION hold cannot be self-cancelled", () => {
  assertSelfActions(renderAppointment("2026-10-01T06:24:00Z", { status: "PENDING_CONFIRMATION" }), false, true);
});

for (const [name, clock, allowed] of [
  ["one millisecond before start", "2026-10-01T02:00:29.999Z", true],
  ["exactly at start", "2026-10-01T02:00:30.000Z", false],
  ["one millisecond after start", "2026-10-01T02:00:30.001Z", false],
]) {
  test(`same-day patient actions ${name} respect business-zone seconds`, () => {
    assertSelfActions(renderAppointment(clock, { appointmentDate: "2026-10-01", startTime: "09:00:30" }), allowed);
  });
}

test("future appointments retain both callbacks even when the current local time is later than their clock time", () => {
  assertSelfActions(renderAppointment("2026-10-01T16:00:00Z", { appointmentDate: "2026-10-02" }), true);
});

for (const [clock, allowed] of [
  ["2026-10-01T01:59:59.999Z", true],
  ["2026-10-01T02:00:00.000Z", false],
]) {
  test(`HH:mm start format at ${clock} retains the exact cutoff`, () => {
    assertSelfActions(renderAppointment(clock, { appointmentDate: "2026-10-01", startTime: "09:00" }), allowed);
  });
}

for (const [clock, allowed] of [
  ["2026-10-01T16:59:59.999Z", true],
  ["2026-10-01T17:00:00.000Z", false],
]) {
  test(`business midnight at ${clock} respects the date and start instant together`, () => {
    assertSelfActions(renderAppointment(clock, { appointmentDate: "2026-10-02", startTime: "00:00:00" }), allowed);
  });
}

test("past confirmed visits retain package details, calendar export and eligible billing actions", () => {
  for (const paymentStatus of ["UNPAID", "PENDING_VERIFICATION", "REJECTED", "PAID", "REFUNDED", "REFUND_PENDING"]) {
    const result = renderAppointment("2026-10-01T06:24:00Z", { paymentStatus });
    assert.ok(result.html.includes("Gói khám Giả Lập"));
    const calendar = result.elements.find((node) => node.type === "a" && text(node) === "Google Calendar");
    assert.equal(new URL(calendar.props.href).searchParams.get("dates"), "20260922T090000/20260922T093000");
    result.action("Tải .ics").props.onClick();
    assert.equal(result.calls.download[0].appointmentId, result.appointment.id);
    const payment = result.elements.find((node) => node.type === "button" && node.props["aria-controls"] === "patient-payment-panel");
    const eligible = ["UNPAID", "PENDING_VERIFICATION", "REJECTED"].includes(paymentStatus);
    assert.equal(Boolean(payment), eligible, `${paymentStatus} billing eligibility`);
    if (payment) {
      assert.equal(payment.props["aria-expanded"], true);
      payment.props.onClick();
      assert.equal(result.calls.payment[0], result.appointment);
    }
  }
});

test("doctor day-scoped actions are unchanged by the patient self-action cutoff", () => {
  const past = renderAppointment("2026-10-01T06:24:00Z", {}, "doctor");
  assert.equal(past.action("Tiếp nhận"), undefined);
  past.action("Không đến").props.onClick();
  assert.equal(past.calls.doctor[0].status, "NO_SHOW");
  assert.ok(!text(past.elements).includes("Đã qua giờ hẹn"));
  const today = renderAppointment("2026-10-01T06:24:00Z", { appointmentDate: "2026-10-01" }, "doctor");
  today.action("Tiếp nhận").props.onClick();
  assert.equal(today.calls.doctor[0].status, "CHECKED_IN");
});

test("future doctor visits expose neither refused day-scoped callback", () => {
  const future = renderAppointment("2026-10-01T16:59:59.999Z", { appointmentDate: "2026-10-02" }, "doctor");
  assert.equal(future.action("Tiếp nhận"), undefined);
  assert.equal(future.action("Không đến"), undefined);
  assert.equal(future.calls.doctor.length, 0);
  assert.ok(text(future.elements).includes("Chỉ thao tác được trong ngày khám"));
});

test("doctor visits become day-actionable at ICT midnight", () => {
  const today = renderAppointment("2026-10-01T17:00:00.000Z", { appointmentDate: "2026-10-02" }, "doctor");
  today.action("Tiếp nhận").props.onClick();
  today.action("Không đến").props.onClick();
  assert.deepEqual(today.calls.doctor.map((call) => call.status), ["CHECKED_IN", "NO_SHOW"]);
});

test("terminal patient states retain their existing action boundary", () => {
  for (const status of ["COMPLETED", "CANCELLED", "NO_SHOW", "IN_PROGRESS", "CHECKED_IN"]) {
    const result = renderAppointment("2026-10-01T06:24:00Z", { status });
    assert.equal(result.action("Đổi lịch"), undefined);
    assert.equal(result.action("Hủy lịch"), undefined);
    assert.ok(!text(result.elements).includes("Đã qua giờ hẹn"));
  }
});
