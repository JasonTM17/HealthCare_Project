import { expect, test, type BrowserContext } from "@playwright/test";
import type {
  Branch,
  Doctor,
  DoctorSchedule,
  DoctorScheduleException,
  Faq,
  HealthPackage,
} from "../../types/hospital";
import type { AdminArticle } from "../../lib/api-client";
import {
  assertNoSensitiveBrowserStorage,
  browserSessionFixture,
  installMockBrowserSession,
} from "./helpers/browser-session";

function pageEnvelope<T>(content: T[]) {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    size: 100,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

async function installAdminSession(context: BrowserContext): Promise<void> {
  await installMockBrowserSession(
    context,
    browserSessionFixture("ADMIN", "admin-critical-actions", "Quản trị thao tác trọng yếu"),
  );
}

test("admin schedule deletion is dialog-gated, contextual, cancelable, and single-submit", async ({ context, page }) => {
  const branch: Branch = {
    id: "branch-q1",
    name: "HealthCare Quận 1",
    slug: "healthcare-quan-1",
    address: "01 Nguyễn Huệ, Quận 1",
    active: true,
  };
  const doctor: Doctor = {
    id: "doctor-minh",
    fullName: "BS.CKII Nguyễn Minh",
    slug: "nguyen-minh",
    bio: "Bác sĩ Tim mạch",
    title: "Bác sĩ Tim mạch",
    branchIds: [branch.id],
    branchNames: [branch.name],
    active: true,
  };
  let schedules: DoctorSchedule[] = [{
    id: "schedule-monday-morning",
    doctorId: doctor.id,
    doctorName: doctor.fullName,
    branchId: branch.id,
    branchName: branch.name,
    dayOfWeek: 1,
    startTime: "08:00:00",
    endTime: "12:00:00",
    slotDurationMinutes: 30,
    effectiveFrom: "2026-09-14",
    effectiveTo: null,
    active: true,
  }];
  const exceptions: DoctorScheduleException[] = [];
  const unexpectedRequests: string[] = [];
  let deleteCount = 0;

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
    const url = new URL(request.url());
    const routeKey = `${request.method()} ${url.pathname}`;

    if (request.method() === "GET" && url.pathname === "/api/v1/admin/schedules") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(schedules)) });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/schedules/exceptions") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(exceptions)) });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/doctors") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([doctor])) });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/branches") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([branch])) });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/hospital/branches") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([branch])) });
      return;
    }
    if (request.method() === "DELETE" && url.pathname === `/api/v1/admin/schedules/${schedules[0]?.id ?? "deleted"}`) {
      deleteCount += 1;
      schedules = [];
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    unexpectedRequests.push(routeKey);
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: `Unhandled admin schedule request: ${routeKey}` }) });
  });
  await installAdminSession(context);

  await page.goto("/admin/schedules");
  const deleteButton = page.getByRole("button", { name: "Xóa lịch của BS.CKII Nguyễn Minh" });
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();

  const dialog = page.getByRole("dialog", { name: "Xóa lịch làm việc này?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("confirm-action-summary")).toContainText("BS.CKII Nguyễn Minh");
  await expect(dialog.getByTestId("confirm-action-summary")).toContainText("HealthCare Quận 1");
  await expect(dialog.getByTestId("confirm-action-summary")).toContainText("Thứ hai · 08:00 - 12:00");
  await expect(dialog.getByText("Bản ghi sẽ bị xóa vĩnh viễn")).toBeVisible();
  await dialog.getByRole("button", { name: "Đóng" }).click();
  await expect(dialog).toBeHidden();
  await expect(deleteButton).toBeFocused();
  expect(deleteCount).toBe(0);

  await deleteButton.click();
  const deleteRequestPromise = page.waitForRequest((request) => (
    request.method() === "DELETE"
    && new URL(request.url()).pathname === "/api/v1/admin/schedules/schedule-monday-morning"
  ));
  await page.getByRole("dialog", { name: "Xóa lịch làm việc này?" })
    .getByRole("button", { name: "Xóa lịch làm việc" })
    .click();
  const deleteRequest = await deleteRequestPromise;

  expect(deleteRequest.headers()["authorization"]).toBeUndefined();
  await expect(page.getByText("Đã xóa lịch làm việc", { exact: true })).toBeVisible();
  await expect(page.getByText("Chưa có lịch", { exact: true })).toBeVisible();
  expect(deleteCount).toBe(1);
  expect(unexpectedRequests).toEqual([]);
  await assertNoSensitiveBrowserStorage(page);
});

test("admin catalog destructive copy offers a hide alternative and rich-text templates require confirmation with undo", async ({ context, page }) => {
  const initialBody = "Nội dung cũ đã được bác sĩ duyệt.";
  const packages: HealthPackage[] = [{
    id: "package-basic",
    name: "Gói tầm soát cơ bản",
    slug: "goi-tam-soat-co-ban",
    description: "Tầm soát sức khỏe định kỳ.",
    price: 1200000,
    active: true,
  }];
  const faqs: Faq[] = [];
  const articles: AdminArticle[] = [{
    id: "article-aftercare",
    title: "Hướng dẫn chăm sóc sau khám",
    slug: "huong-dan-cham-soc-sau-kham",
    summary: "Các bước tự theo dõi sau khi hoàn tất lịch khám.",
    body: initialBody,
    publishedAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-09-01T08:30:00Z",
    category: "Hướng dẫn",
    authorName: "BS.CKII Nguyễn Minh",
    readingMinutes: 4,
    relatedSpecialtySlug: "tim-mach",
    contentKind: "GENERAL",
    tags: ["theo dõi"],
    scheduledPublishAt: null,
    version: 3,
    sections: [],
    contentLanguage: "vi-VN",
    audience: "PATIENT",
    topicTags: ["sau khám"],
    keyTakeaways: ["Theo dõi triệu chứng"],
    warningSigns: [],
    preventionTips: [],
    whenToSeekCare: "Liên hệ bác sĩ khi triệu chứng nặng hơn.",
    sourceReferences: [],
    clinicalMetadata: { reviewer: "doctor-minh" },
    clinicalDisclaimer: "Thông tin chỉ nhằm giáo dục sức khỏe.",
    featured: false,
    active: true,
  }];
  const unexpectedRequests: string[] = [];
  let articleDeleteCount = 0;

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
    const url = new URL(request.url());
    const routeKey = `${request.method()} ${url.pathname}`;

    if (request.method() === "GET" && url.pathname === "/api/v1/admin/packages") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(packages)) });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/faqs") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(faqs)) });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/articles") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(articles)) });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/hospital/branches") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([])) });
      return;
    }
    if (request.method() === "DELETE" && url.pathname === "/api/v1/admin/articles/huong-dan-cham-soc-sau-kham") {
      articleDeleteCount += 1;
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    unexpectedRequests.push(routeKey);
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: `Unhandled admin catalog request: ${routeKey}` }) });
  });
  await installAdminSession(context);

  await page.goto("/admin/catalog");
  await expect(page.getByRole("heading", { name: "Biên tập bài viết y khoa", exact: true })).toBeVisible();

  const articleDeleteButton = page.getByRole("button", { name: "Xóa Hướng dẫn chăm sóc sau khám" });
  await articleDeleteButton.click();
  const deleteDialog = page.getByRole("dialog", { name: /Xóa bài viết "Hướng dẫn chăm sóc sau khám"/ });
  await expect(deleteDialog).toContainText("Nếu chỉ muốn tạm gỡ, hãy dùng trạng thái “Tạm ẩn”.");
  await expect(deleteDialog.getByTestId("confirm-action-summary")).toContainText("huong-dan-cham-soc-sau-kham");
  await deleteDialog.getByRole("button", { name: "Đóng" }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(articleDeleteButton).toBeFocused();
  expect(articleDeleteCount).toBe(0);

  await page.getByRole("button", { name: "Sửa Hướng dẫn chăm sóc sau khám" }).click();
  await page.getByRole("button", { name: "Mã nguồn" }).click();
  const editor = page.getByLabel("Nội dung bài viết y khoa (Body)");
  await expect(editor).toHaveValue(initialBody);

  await page.getByRole("button", { name: /Mẫu bài viết/ }).click();
  await page.getByRole("button", { name: /Cẩm nang chăm sóc & điều trị bệnh/ }).click();
  const templateDialog = page.getByRole("dialog", { name: "Thêm mẫu y khoa vào bài viết đã có nội dung?" });
  await expect(templateDialog).toContainText("Nội dung hiện tại sẽ được giữ nguyên");
  await expect(templateDialog.getByTestId("confirm-action-summary")).toContainText("Cẩm nang chăm sóc & điều trị bệnh");
  await templateDialog.getByRole("button", { name: "Hủy" }).click();
  await expect(templateDialog).toBeHidden();
  await expect(editor).toHaveValue(initialBody);

  await page.getByRole("button", { name: /Mẫu bài viết/ }).click();
  await page.getByRole("button", { name: /Cẩm nang chăm sóc & điều trị bệnh/ }).click();
  await page.getByRole("dialog", { name: "Thêm mẫu y khoa vào bài viết đã có nội dung?" })
    .getByRole("button", { name: "Áp dụng mẫu" })
    .click();
  await expect(editor).toHaveValue(/## 1\. Tổng quan tình trạng & Định nghĩa/);
  await page.getByRole("button", { name: /Hoàn tác/ }).click();
  await expect(editor).toHaveValue(initialBody);

  expect(articleDeleteCount).toBe(0);
  expect(unexpectedRequests).toEqual([]);
  await assertNoSensitiveBrowserStorage(page);
});

test("admin catalog keyboard reorder persists and failed reorder rolls back", async ({ context, page }) => {
  let packages: HealthPackage[] = [
    { id: "package-a", name: "Gói A", slug: "goi-a", description: "A", price: 100000, active: true, version: 1, displayOrder: 0 },
    { id: "package-b", name: "Gói B", slug: "goi-b", description: "B", price: 200000, active: true, version: 1, displayOrder: 1 },
  ];
  const faqs: Faq[] = [
    { id: "faq-a", question: "Câu hỏi A", answer: "Trả lời A", active: true, version: 2, displayOrder: 0 },
    { id: "faq-b", question: "Câu hỏi B", answer: "Trả lời B", active: true, version: 4, displayOrder: 1 },
  ];
  const orderPayloads: unknown[] = [];
  let packageOrderRequests = 0;

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/packages") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(packages)) });
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/faqs") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(faqs)) });
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/articles") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([])) });
    if (request.method() === "GET" && url.pathname === "/api/v1/hospital/branches") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([])) });
    if (request.method() === "PUT" && url.pathname === "/api/v1/admin/packages/order") {
      packageOrderRequests += 1;
      const payload = request.postDataJSON();
      orderPayloads.push(payload);
      await new Promise((resolve) => setTimeout(resolve, 250));
      packages = payload.items.map((entry: { id: string }, index: number) => ({ ...packages.find((item) => item.id === entry.id)!, displayOrder: index, version: 2 }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(packages) });
    }
    if (request.method() === "PUT" && url.pathname === "/api/v1/admin/faqs/order") {
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "CONFLICT" }) });
    }
    return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "UNEXPECTED_REQUEST" }) });
  });
  await installAdminSession(context);
  await page.goto("/admin/catalog");

  const movePackageDown = page.getByRole("button", { name: "Di chuyển Gói A xuống" });
  await movePackageDown.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByText("Đã lưu thứ tự gói khám")).toBeVisible();
  expect(packageOrderRequests).toBe(1);
  expect(orderPayloads).toEqual([{ items: [{ id: "package-b", version: 1 }, { id: "package-a", version: 1 }] }]);

  const successToast = page.getByRole("status").filter({ hasText: "Đã lưu thứ tự gói khám" });
  const closeToast = successToast.getByRole("button", { name: "Đóng thông báo" });
  await closeToast.focus();
  await successToast.hover();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(4200);
  await expect(successToast).toBeVisible();
  await closeToast.click();

  await page.reload();
  await expect(page.locator('[data-id^="package-"]').first()).toContainText("Gói B");

  await page.getByRole("button", { name: "Di chuyển Câu hỏi A xuống" }).click();
  await expect(page.getByText("Đã hoàn tác thứ tự FAQ")).toBeVisible();
  await expect(page.locator('[data-id^="faq-"]').first()).toContainText("Câu hỏi A");
  await assertNoSensitiveBrowserStorage(page);
});

test("stale catalog broadcast load cannot overwrite a newer load result", async ({ context, page }) => {
  // Cross-tab interleaving: tab A's broadcast starts load gen2; tab B's newer
  // change arrives and load gen3 renders the fresh order; gen2's slow GET
  // settles last and must be discarded by the generation guard.
  let packages: HealthPackage[] = [
    { id: "package-a", name: "Gói A", slug: "goi-a", description: "A", price: 100000, active: true, version: 1, displayOrder: 0 },
    { id: "package-b", name: "Gói B", slug: "goi-b", description: "B", price: 200000, active: true, version: 1, displayOrder: 1 },
  ];
  let packagesGetCount = 0;
  const staleGate: { release: (() => void) | null } = { release: null };

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/packages") {
      packagesGetCount += 1;
      if (packagesGetCount === 2) {
        // gen2: hold this GET so it settles after gen3's fresh response.
        await new Promise<void>((resolve) => { staleGate.release = resolve; });
        const stale: HealthPackage[] = [
          { ...packages.find((item) => item.id === "package-a")!, displayOrder: 0 },
          { ...packages.find((item) => item.id === "package-b")!, displayOrder: 1 },
        ];
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(stale)) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(packages)) });
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/faqs") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([])) });
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/articles") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([])) });
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/hospital/branches") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([])) });
    }
    return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "UNEXPECTED_REQUEST" }) });
  });
  await installAdminSession(context);
  await page.goto("/admin/catalog");
  await expect(page.locator('[data-id^="package-"]').first()).toContainText("Gói A");

  // gen2 broadcast: its GET response is held pending by the route handler.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("healthcare:catalog-update", { detail: { kind: "package", action: "updated" } })));
  await page.waitForTimeout(300);

  // gen3 broadcast: a newer server state ([B, A], e.g. another admin's save).
  packages = [
    { id: "package-b", name: "Gói B", slug: "goi-b", description: "B", price: 200000, active: true, version: 2, displayOrder: 0 },
    { id: "package-a", name: "Gói A", slug: "goi-a", description: "A", price: 100000, active: true, version: 2, displayOrder: 1 },
  ];
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("healthcare:catalog-update", { detail: { kind: "package", action: "updated" } })));
  await expect(page.locator('[data-id^="package-"]').first()).toContainText("Gói B");

  // The stale gen2 GET settles last; the guard must discard it.
  staleGate.release?.();
  await page.waitForTimeout(500);
  await expect(page.locator('[data-id^="package-"]').first()).toContainText("Gói B");
  await assertNoSensitiveBrowserStorage(page);
});

test("cross-tab load during an in-flight reorder cannot revert the saved order", async ({ context, page }) => {
  // Wukong F4: a broadcast load that starts while a reorder PUT is in flight is
  // served from a pre-commit snapshot; it must be discarded once the reorder
  // commits, otherwise the list silently reverts the just-saved order.
  let packages: HealthPackage[] = [
    { id: "package-a", name: "Gói A", slug: "goi-a", description: "A", price: 100000, active: true, version: 1, displayOrder: 0 },
    { id: "package-b", name: "Gói B", slug: "goi-b", description: "B", price: 200000, active: true, version: 1, displayOrder: 1 },
  ];
  const reorderGate: { release: (() => void) | null } = { release: null };
  const loadGate: { release: (() => void) | null } = { release: null };
  let holdNextLoad = false;

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/packages") {
      if (holdNextLoad) {
        holdNextLoad = false;
        // Capture the pre-commit snapshot before parking this response.
        const staleBody = JSON.stringify(pageEnvelope(packages));
        await new Promise<void>((resolve) => { loadGate.release = resolve; });
        return route.fulfill({ status: 200, contentType: "application/json", body: staleBody });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(packages)) });
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/faqs") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([])) });
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/articles") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([])) });
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/hospital/branches") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([])) });
    }
    if (request.method() === "PUT" && url.pathname === "/api/v1/admin/packages/order") {
      await new Promise<void>((resolve) => { reorderGate.release = resolve; });
      const payload = request.postDataJSON();
      packages = payload.items.map((entry: { id: string }, index: number) => ({
        ...packages.find((item) => item.id === entry.id)!,
        displayOrder: index,
        version: 2,
      }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(packages) });
    }
    return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "UNEXPECTED_REQUEST" }) });
  });
  await installAdminSession(context);
  await page.goto("/admin/catalog");
  await expect(page.locator('[data-id^="package-"]').first()).toContainText("Gói A");

  // Start a reorder; its PUT stays in flight.
  await page.getByRole("button", { name: "Di chuyển Gói A xuống" }).click();
  await expect.poll(() => reorderGate.release !== null, { timeout: 5000 }).toBe(true);

  // Cross-tab broadcast while the reorder is in flight; park this load's GET too.
  holdNextLoad = true;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("healthcare:catalog-update", { detail: { kind: "package", action: "updated" } })));
  await expect.poll(() => loadGate.release !== null, { timeout: 5000 }).toBe(true);

  // Commit the reorder, then let the stale pre-commit load settle last.
  reorderGate.release?.();
  await expect(page.locator('[data-id^="package-"]').first()).toContainText("Gói B");
  loadGate.release?.();
  await page.waitForTimeout(500);
  await expect(page.locator('[data-id^="package-"]').first()).toContainText("Gói B");
  await assertNoSensitiveBrowserStorage(page);
});
