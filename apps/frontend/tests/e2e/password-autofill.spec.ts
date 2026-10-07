import { expect, test, type Page } from "@playwright/test";
import {
  browserSessionFixture,
  doctorProfileFixture,
  installMockBrowserSession,
  patientAiCreditStatusFixture,
  patientOverviewFixture,
  patientProfileFixture,
} from "./helpers/browser-session";
import { fulfillBackendWarmup } from "./helpers/backend-warmup";

const REGISTER_AUTOFILL = {
  displayName: "Autofill Tester",
  phone: "0901234567",
  email: "autofill.register@example.test",
  password: "Autofill!Pass42",
  confirmPassword: "Autofill!Pass42",
};

const RESET_AUTOFILL = {
  email: "autofill.reset@example.test",
  code: "123456",
  password: "Autofill!Pass42",
  confirmPassword: "Autofill!Pass42",
};

const CHANGE_AUTOFILL = {
  currentPassword: "Autofill!Old99",
  newPassword: "Autofill!Pass42",
  confirmPassword: "Autofill!Pass42",
};

const VERIFY_AUTOFILL = {
  email: "autofill.verify@example.test",
  code: "654321",
};

const PASSWORD_FORM = "form:has(input[name=\"currentPassword\"])";

async function nativeSet(page: Page, formSelector: string, values: Record<string, string>): Promise<void> {
  await page.evaluate(({ formSelector, values }) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("native input value setter unavailable");
    const form = document.querySelector<HTMLFormElement>(formSelector);
    if (!form) throw new Error(`form not found: ${formSelector}`);
    for (const [name, value] of Object.entries(values)) {
      const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
      if (!input) throw new Error(`input not found in ${formSelector}: ${name}`);
      setter.call(input, value);
    }
  }, { formSelector, values });
}

async function requestSubmit(page: Page, formSelector: string): Promise<void> {
  await page.evaluate((formSelector) => {
    const form = document.querySelector<HTMLFormElement>(formSelector);
    if (!form) throw new Error(`form not found: ${formSelector}`);
    form.requestSubmit();
  }, formSelector);
}

async function rejectUnhandledApi(page: Page): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "E2E_UNMOCKED_ENDPOINT" }),
    });
  });
}

test("register form sends DOM-autofilled values and preserves them across a rejected submit", async ({ context, page }) => {
  const calls: unknown[] = [];
  await rejectUnhandledApi(page);
  await installMockBrowserSession(page, null);
  await page.route("**/api/v1/auth/register", async (route) => {
    calls.push(route.request().postDataJSON());
    const first = calls.length === 1;
    await route.fulfill({
      status: first ? 400 : 202,
      contentType: "application/json",
      body: JSON.stringify(first
        ? { code: "EMAIL_ALREADY_REGISTERED", fieldErrors: {} }
        : { email: REGISTER_AUTOFILL.email, resendAfterSeconds: 60 }),
    });
  });

  await page.goto("/auth/register");
  await page.locator("form.auth-form").waitFor();
  await nativeSet(page, "form.auth-form", REGISTER_AUTOFILL);
  await requestSubmit(page, "form.auth-form");

  await expect.poll(() => calls.length).toBe(1);
  for (const [name, value] of Object.entries(REGISTER_AUTOFILL)) {
    await expect(page.locator(`form.auth-form [name="${name}"]`)).toHaveValue(value);
  }

  await requestSubmit(page, "form.auth-form");
  await expect.poll(() => calls.length).toBe(2);

  const expected = {
    displayName: REGISTER_AUTOFILL.displayName,
    phone: REGISTER_AUTOFILL.phone,
    email: REGISTER_AUTOFILL.email,
    password: REGISTER_AUTOFILL.password,
  };
  expect(calls).toEqual([expected, expected]);
  await expect(page.getByText("Kiểm tra email để tiếp tục", { exact: true })).toBeVisible();
});

test("verify-email form sends DOM-autofilled OTP and preserves fields across a rejected submit", async ({ context, page }) => {
  const calls: unknown[] = [];
  await rejectUnhandledApi(page);
  await installMockBrowserSession(page, null);
  const session = browserSessionFixture("PATIENT", "verify-autofill-e2e", "Bệnh nhân Autofill");
  await page.route("**/api/v1/auth/browser-sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    calls.push(route.request().postDataJSON());
    const first = calls.length === 1;
    await route.fulfill({
      status: first ? 400 : 200,
      contentType: "application/json",
      body: JSON.stringify(first
        ? { code: "OTP_EXPIRED", fieldErrors: { code: "Mã xác minh chưa hợp lệ." } }
        : session),
    });
  });

  await page.goto("/auth/verify-email");
  await page.locator("form.auth-form").waitFor();
  await nativeSet(page, "form.auth-form", {
    email: ` ${VERIFY_AUTOFILL.email} `,
    code: ` ${VERIFY_AUTOFILL.code} `,
  });
  await requestSubmit(page, "form.auth-form");

  await expect.poll(() => calls.length).toBe(1);
  await expect(page.locator("#verify-email")).toHaveValue(VERIFY_AUTOFILL.email);
  await expect(page.locator("#verify-code")).toHaveValue(` ${VERIFY_AUTOFILL.code} `);

  await requestSubmit(page, "form.auth-form");
  await expect.poll(() => calls.length).toBe(2);

  const expected = {
    grantType: "EMAIL_VERIFICATION",
    email: VERIFY_AUTOFILL.email,
    code: VERIFY_AUTOFILL.code,
  };
  expect(calls).toEqual([expected, expected]);
});

test("reset password form sends DOM-autofilled values exactly", async ({ context, page }) => {
  const calls: unknown[] = [];
  await rejectUnhandledApi(page);
  await installMockBrowserSession(page, null);
  await page.route("**/api/v1/auth/password-reset-requests/confirm", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/auth/reset-password");
  await page.locator("form.auth-form").waitFor();
  await nativeSet(page, "form.auth-form", {
    email: ` ${RESET_AUTOFILL.email} `,
    code: ` ${RESET_AUTOFILL.code} `,
    password: RESET_AUTOFILL.password,
    confirmPassword: RESET_AUTOFILL.confirmPassword,
  });
  await requestSubmit(page, "form.auth-form");

  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toEqual({
    email: RESET_AUTOFILL.email,
    otp: RESET_AUTOFILL.code,
    newPassword: RESET_AUTOFILL.password,
  });
});

test("patient profile change-password sends DOM-autofilled values exactly", async ({ context, page }) => {
  const calls: unknown[] = [];
  await rejectUnhandledApi(page);
  const session = browserSessionFixture("PATIENT", "patient-autofill-e2e", "Bệnh nhân Autofill");
  await installMockBrowserSession(page, session);
  await page.route("**/api/v1/patient/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(patientProfileFixture(session)),
    });
  });
  await page.route("**/api/v1/patient/ai-credits/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(patientAiCreditStatusFixture()),
    });
  });
  await page.route("**/api/v1/patient/overview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(patientOverviewFixture()),
    });
  });
  await page.route("**/api/v1/auth/change-password", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Đã cập nhật mật khẩu tài khoản thành công!" }),
    });
  });

  await page.goto("/patient/profile");
  await page.locator(PASSWORD_FORM).waitFor();
  await nativeSet(page, PASSWORD_FORM, CHANGE_AUTOFILL);
  await requestSubmit(page, PASSWORD_FORM);

  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toEqual({
    currentPassword: CHANGE_AUTOFILL.currentPassword,
    newPassword: CHANGE_AUTOFILL.newPassword,
  });
});

test("patient dashboard change-password sends DOM-autofilled values exactly", async ({ context, page }) => {
  const calls: unknown[] = [];
  await rejectUnhandledApi(page);
  const session = browserSessionFixture("PATIENT", "patient-dash-autofill-e2e", "Bệnh nhân Autofill");
  await installMockBrowserSession(page, session);
  const payloads: Record<string, unknown> = {
    "/api/v1/patient/profile": patientProfileFixture(session),
    "/api/v1/patient/ai-credits/status": patientAiCreditStatusFixture(),
    "/api/v1/patient/overview": patientOverviewFixture(),
  };
  for (const [path, body] of Object.entries(payloads)) {
    await page.route(`**${path}`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
  }
  await page.route("**/api/v1/auth/change-password", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Đã cập nhật mật khẩu thành công." }),
    });
  });

  await page.goto("/patient/dashboard#profile");
  await page.locator(PASSWORD_FORM).waitFor();
  await nativeSet(page, PASSWORD_FORM, CHANGE_AUTOFILL);
  await requestSubmit(page, PASSWORD_FORM);

  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toEqual({
    currentPassword: CHANGE_AUTOFILL.currentPassword,
    newPassword: CHANGE_AUTOFILL.newPassword,
  });
});

test("doctor profile change-password sends DOM-autofilled values exactly", async ({ context, page }) => {
  const calls: unknown[] = [];
  await rejectUnhandledApi(page);
  const session = browserSessionFixture("DOCTOR", "doctor-autofill-e2e", "Bác sĩ Autofill");
  await installMockBrowserSession(page, session);
  await page.route("**/api/v1/doctor/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(doctorProfileFixture(session)),
    });
  });
  await page.route("**/api/v1/auth/change-password", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Đã cập nhật mật khẩu thành công." }),
    });
  });

  await page.goto("/doctor/profile");
  await page.locator(PASSWORD_FORM).waitFor();
  await nativeSet(page, PASSWORD_FORM, CHANGE_AUTOFILL);
  await requestSubmit(page, PASSWORD_FORM);

  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toEqual({
    currentPassword: CHANGE_AUTOFILL.currentPassword,
    newPassword: CHANGE_AUTOFILL.newPassword,
  });
});
