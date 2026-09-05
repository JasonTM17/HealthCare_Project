import { expect, type BrowserContext, type Page } from "@playwright/test";
import type { AiCreditStatus } from "../../../lib/api-client";
import type { AuthUser, Doctor, PatientProfile } from "../../../types/hospital";

export interface BrowserSessionFixture {
  user: AuthUser;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export function browserSessionFixture(
  role: "PATIENT" | "DOCTOR" | "ADMIN",
  id: string,
  displayName: string,
): BrowserSessionFixture {
  return {
    user: {
      id,
      email: `${id}@e2e.healthcare.local`,
      displayName,
      roles: [`ROLE_${role}`],
      emailVerified: true,
    },
    idleExpiresAt: "2099-01-01T00:30:00Z",
    absoluteExpiresAt: "2099-01-01T12:00:00Z",
  };
}

function expectedBrowserOrigin(): string {
  return new URL(
    process.env.PLAYWRIGHT_BASE_URL
      ?? `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3000"}`,
  ).origin;
}

export async function installMockBrowserSession(
  target: BrowserContext | Page,
  session: BrowserSessionFixture | null,
): Promise<void> {
  await target.route("**/api/v1/auth/browser-sessions/current", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("GET");
    expect(new URL(request.url()).origin).toBe(expectedBrowserOrigin());
    expect(request.headers()["authorization"]).toBeUndefined();
    await route.fulfill({
      status: session ? 200 : 401,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(session ?? { code: "BROWSER_SESSION_REQUIRED" }),
    });
  });
}

export function patientProfileFixture(
  session: BrowserSessionFixture,
  overrides: Partial<PatientProfile> = {},
): PatientProfile {
  return {
    id: session.user.id,
    fullName: session.user.displayName,
    phone: "0900000001",
    email: session.user.email,
    dateOfBirth: null,
    gender: null,
    address: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    avatarUrl: null,
    medicalHistory: null,
    allergies: null,
    bloodType: null,
    patientTier: "STANDARD",
    aiCredits: 12,
    updatedAt: "2026-08-23T00:00:00Z",
    ...overrides,
  };
}

export function patientAiCreditStatusFixture(
  overrides: Partial<AiCreditStatus> = {},
): AiCreditStatus {
  return {
    tier: "STANDARD",
    credits: 12,
    maxCredits: 20,
    history: [],
    ...overrides,
  };
}

export function doctorProfileFixture(
  session: BrowserSessionFixture,
  overrides: Partial<Doctor> = {},
): Doctor {
  return {
    id: session.user.id,
    fullName: session.user.displayName,
    slug: session.user.id,
    bio: "Ho so bac si kiem thu.",
    active: true,
    title: "Bac si chuyen khoa",
    specialtyName: "Noi tong quat",
    experienceYears: 10,
    branchIds: [],
    branchNames: [],
    specialtySlugs: [],
    achievements: null,
    aiCredits: 12,
    ...overrides,
  };
}

export function doctorAiCreditStatusFixture(
  overrides: Partial<AiCreditStatus> = {},
): AiCreditStatus {
  return {
    tier: "STANDARD",
    credits: 12,
    maxCredits: 20,
    history: [],
    ...overrides,
  };
}

export async function installMockPatientPortalSession(
  target: BrowserContext | Page,
  session: BrowserSessionFixture,
  options: {
    profile?: Partial<PatientProfile>;
    credits?: Partial<AiCreditStatus>;
  } = {},
): Promise<void> {
  await installMockBrowserSession(target, session);

  await target.route("**/api/v1/patient/profile", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("GET");
    expect(new URL(request.url()).origin).toBe(expectedBrowserOrigin());
    expect(request.headers()["authorization"]).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(patientProfileFixture(session, options.profile)),
    });
  });

  await target.route("**/api/v1/patient/ai-credits/status", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("GET");
    expect(new URL(request.url()).origin).toBe(expectedBrowserOrigin());
    expect(request.headers()["authorization"]).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(patientAiCreditStatusFixture(options.credits)),
    });
  });
}

export async function installMockDoctorPortalSession(
  target: BrowserContext | Page,
  session: BrowserSessionFixture,
  options: {
    profile?: Partial<Doctor>;
    credits?: Partial<AiCreditStatus>;
  } = {},
): Promise<void> {
  await installMockBrowserSession(target, session);

  await target.route("**/api/v1/doctor/profile", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("GET");
    expect(new URL(request.url()).origin).toBe(expectedBrowserOrigin());
    expect(request.headers()["authorization"]).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(doctorProfileFixture(session, options.profile)),
    });
  });

  await target.route("**/api/v1/doctor/ai-credits/status", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("GET");
    expect(new URL(request.url()).origin).toBe(expectedBrowserOrigin());
    expect(request.headers()["authorization"]).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(doctorAiCreditStatusFixture(options.credits)),
    });
  });
}

export async function assertNoSensitiveBrowserStorage(
  page: Page,
  sensitiveValues: readonly string[] = [],
): Promise<void> {
  const storageText = await page.evaluate(() => {
    const entries = (storage: Storage, label: string): string[] => (
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? "";
        return `${label}:${key}=${storage.getItem(key) ?? ""}`;
      })
    );
    return [...entries(localStorage, "local"), ...entries(sessionStorage, "session")].join("\n");
  });

  expect(storageText).not.toMatch(/healthcare\.auth\.session|accessToken|refreshToken|Bearer\s+/iu);
  for (const value of sensitiveValues) {
    expect(storageText).not.toContain(value);
  }
}
