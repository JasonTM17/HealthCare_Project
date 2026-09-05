import { expect, test, type BrowserContext } from "@playwright/test";
import type {
  AiContentRevision,
  AiContentReviewSummary,
} from "../../types/hospital";
import {
  browserSessionFixture,
  installMockBrowserSession,
  installMockDoctorPortalSession,
} from "./helpers/browser-session";

interface PageEnvelope<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const HASH = "a".repeat(64);
const ADMIN_SESSION = browserSessionFixture("ADMIN", "admin-review-e2e", "Quản trị nội dung E2E");
const DOCTOR_SESSION = browserSessionFixture("DOCTOR", "doctor-review-e2e", "Bác sĩ duyệt E2E");

function summary(state: AiContentReviewSummary["state"]): AiContentReviewSummary {
  return {
    sourceType: "ARTICLE",
    sourceId: SOURCE_ID,
    title: "Hướng dẫn sức khỏe đã chuẩn hóa",
    state,
    revision: 7,
    contentHash: HASH,
    eligibilityRevision: 11,
    approvalRound: null,
    submittedAt: state === "DRAFT" ? null : "2026-08-25T09:00:00Z",
    approvedAt: null,
    expiresAt: null,
  };
}

function pageEnvelope<T>(items: T[]): PageEnvelope<T> {
  return {
    content: items,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    size: 50,
    number: 0,
    first: true,
    last: true,
    empty: items.length === 0,
  };
}

async function installAdminReviewMocks(
  context: BrowserContext,
  observed: { submission: unknown },
): Promise<void> {
  let state: AiContentReviewSummary["state"] = "DRAFT";
  await context.route("**/api/v1/admin/ai-content**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.headers()["authorization"]).toBeUndefined();

    if (url.pathname === "/api/v1/admin/ai-content" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(pageEnvelope([summary(state)])),
      });
      return;
    }

    if (
      url.pathname === `/api/v1/admin/ai-content/ARTICLE/${SOURCE_ID}/submission`
      && request.method() === "PUT"
    ) {
      observed.submission = request.postDataJSON();
      state = "SUBMITTED";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary(state)) });
      return;
    }

    throw new Error(`Unexpected admin review request: ${request.method()} ${url.pathname}${url.search}`);
  });
  await installMockBrowserSession(context, ADMIN_SESSION);
}

test("ADMIN submits the exact inventory revision and hash without gaining approval authority", async ({ context, page }) => {
  const observed = { submission: null as unknown };
  await installAdminReviewMocks(context, observed);

  await page.goto("/admin/ai-content-reviews");
  await expect(page.getByRole("heading", { name: "Kho revision nội dung AI" })).toBeVisible();
  await page.getByRole("button", { name: /Xem Hướng dẫn sức khỏe đã chuẩn hóa, revision 7/ }).click();
  await expect(page.getByRole("heading", { name: "Hướng dẫn sức khỏe đã chuẩn hóa", exact: true })).toBeVisible();
  await page.getByRole("dialog", { name: /Xem trước: Hướng dẫn sức khỏe đã chuẩn hóa/ })
    .getByRole("button", { name: "Gửi revision cho bác sĩ duyệt", exact: true })
    .click();

  await expect(page.getByRole("status").filter({ hasText: "Đã gửi bài viết revision 7" })).toBeVisible();
  expect(observed.submission).toEqual({ revision: 7, contentHash: HASH });
  await expect(page.getByRole("button", { name: "Duyệt nội dung", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ghi quyết định", exact: true })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /Hướng dẫn sức khỏe đã chuẩn hóa/ })
    .getByLabel("Trạng thái: Chờ bác sĩ duyệt")).toBeVisible();
});

async function installDoctorReviewMocks(
  context: BrowserContext,
  options: { staleDecision?: boolean } = {},
): Promise<{ decisions: Array<{ decision: string; reason?: string }> }> {
  const decisions: Array<{ decision: string; reason?: string }> = [];
  const revision: AiContentRevision = {
    sourceType: "ARTICLE",
    sourceId: SOURCE_ID,
    revision: 7,
    contentHash: HASH,
    state: "SUBMITTED",
    snapshot: {
      title: "Hướng dẫn sức khỏe đã chuẩn hóa",
      summary: "Bản tóm tắt không chứa dữ liệu bệnh nhân.",
    },
    diff: {
      summary: {
        before: "Tóm tắt cũ",
        after: "Bản tóm tắt không chứa dữ liệu bệnh nhân.",
      },
    },
    approvalId: null,
    expiresAt: null,
  };

  await context.route("**/api/v1/doctor/ai-content/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.headers()["authorization"]).toBeUndefined();

    if (url.pathname === "/api/v1/doctor/ai-content/reviews" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(pageEnvelope([summary("SUBMITTED")])),
      });
      return;
    }

    if (
      url.pathname === `/api/v1/doctor/ai-content/ARTICLE/${SOURCE_ID}/revisions/7`
      && request.method() === "GET"
    ) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(revision) });
      return;
    }

    if (
      url.pathname === `/api/v1/doctor/ai-content/ARTICLE/${SOURCE_ID}/revisions/7/decision`
      && request.method() === "PUT"
    ) {
      decisions.push(request.postDataJSON() as { decision: string; reason?: string });
      if (options.staleDecision) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "AI_CONTENT_REVISION_STALE",
            message: "patient_name=Nguyễn Văn Bí mật upstream=http://clinical-db.internal:5432",
            stack: "ClinicalApprovalStackTrace",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...summary("APPROVED"), approvedAt: "2026-08-25T09:30:00Z", approvalRound: 1 }),
      });
      return;
    }

    throw new Error(`Unexpected doctor review request: ${request.method()} ${url.pathname}${url.search}`);
  });
  await installMockDoctorPortalSession(context, DOCTOR_SESSION);
  return { decisions };
}

test("independent DOCTOR reviews immutable snapshot and field diff before an exact decision", async ({ context, page }) => {
  const observed = await installDoctorReviewMocks(context);

  await page.goto("/doctor/ai-content-reviews");
  await expect(page.getByRole("heading", { name: "Duyệt nguồn AI" })).toBeVisible();
  await page.getByRole("button", { name: /Mở Hướng dẫn sức khỏe đã chuẩn hóa, revision 7/ }).click();
  await expect(page.getByRole("heading", { name: "Snapshot revision 7" })).toBeVisible();
  await expect(page.getByText("Trước thay đổi")).toBeVisible();
  await expect(page.getByText("Sau thay đổi")).toBeVisible();
  await expect(page.getByText("Tóm tắt cũ", { exact: true })).toBeVisible();
  await expect(page.getByText("Bản tóm tắt không chứa dữ liệu bệnh nhân.", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: "Ghi quyết định" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Quyết định đã được ghi vào audit log" })).toBeVisible();
  expect(observed.decisions).toEqual([{ decision: "APPROVE" }]);
});

test("stale doctor decision fails closed with code-owned copy and no raw PHI or infrastructure leak", async ({ context, page }) => {
  const observed = await installDoctorReviewMocks(context, { staleDecision: true });

  await page.goto("/doctor/ai-content-reviews");
  await page.getByRole("button", { name: /Mở Hướng dẫn sức khỏe đã chuẩn hóa, revision 7/ }).click();
  await page.getByRole("button", { name: "Ghi quyết định" }).click();

  await expect(page.getByRole("alert").filter({
    hasText: "Nội dung đã có phiên bản mới. Vui lòng tải lại trước khi tiếp tục.",
  })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải lại revision" })).toBeVisible();
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("Nguyễn Văn Bí mật");
  expect(bodyText).not.toContain("clinical-db.internal");
  expect(bodyText).not.toContain("ClinicalApprovalStackTrace");
  expect(observed.decisions).toEqual([{ decision: "APPROVE" }]);
});

test("non-doctor role is rejected before the clinical review queue is requested", async ({ context, page }) => {
  let doctorApiRequests = 0;
  await context.route("**/api/v1/doctor/ai-content/**", async (route) => {
    doctorApiRequests += 1;
    await route.fulfill({ status: 403, contentType: "application/json", body: "{}" });
  });
  await installMockBrowserSession(
    context,
    browserSessionFixture("PATIENT", "patient-review-e2e", "Bệnh nhân không có quyền duyệt"),
  );

  await page.goto("/doctor/ai-content-reviews");
  await expect(page.getByRole("heading", { name: "Tài khoản không có quyền mở cổng thông tin này" })).toBeVisible();
  await expect(page.getByText("Khu vực này chỉ dành cho tài khoản bác sĩ.")).toBeVisible();
  expect(doctorApiRequests).toBe(0);
});
