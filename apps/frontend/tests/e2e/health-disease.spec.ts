import { expect, test, type BrowserContext, type Route } from "@playwright/test";
import type { Article, HealthQuestionSummary } from "../../types/hospital";
import {
  assertNoSensitiveBrowserStorage,
  installMockBrowserSession,
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

const DISEASE_GUIDE: Article = {
  id: "article-hypertension-e2e",
  slug: "hieu-dung-huyet-ap",
  title: "Hiểu đúng về huyết áp",
  summary: "Thông tin giáo dục sức khỏe giúp chuẩn bị câu hỏi trước khi đi khám.",
  body: "Theo dõi thông tin theo hướng dẫn của cơ sở y tế.",
  contentKind: "DISEASE_GUIDE",
  category: "CARDIOLOGY",
  readingMinutes: 6,
  authorName: "Ban biên tập HealthCare",
  publishedAt: "2026-08-20T08:00:00Z",
  updatedAt: "2026-08-24T09:00:00Z",
  relatedSpecialtySlug: "tim-mach",
  warningSigns: ["Triệu chứng đột ngột hoặc nặng lên nhanh"],
  clinicalDisclaimer: "Thông tin này chỉ nhằm giáo dục sức khỏe, không phải chẩn đoán hay đơn thuốc.",
};

const GENERAL_ARTICLE: Article = {
  id: "article-general-e2e",
  slug: "tin-noi-bo-khong-duyet-clinical",
  title: "Bài GENERAL không được gắn nhãn clinical",
  summary: "Nội dung tổng quát không thuộc kho bệnh phổ biến.",
  contentKind: "GENERAL",
  publishedAt: "2026-08-20T08:00:00Z",
};

const PUBLISHED_QUESTION: HealthQuestionSummary = {
  id: "question-published-e2e",
  topicSlug: "BLOOD_PRESSURE",
  publicAlias: "Người hỏi ẩn danh 12",
  question: "Nên chuẩn bị câu hỏi gì khi đi khám huyết áp?",
  answer: "Hãy ghi lại điều bạn muốn trao đổi và mang theo thông tin đã được cơ sở y tế yêu cầu.",
  answerStatus: "PUBLISHED",
  status: "PUBLISHED",
  createdAt: "2026-08-22T10:00:00Z",
};

function pageEnvelope<T>(items: T[]): PageEnvelope<T> {
  return {
    content: items,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    size: 100,
    number: 0,
    first: true,
    last: true,
    empty: items.length === 0,
  };
}

async function installDiseaseHubMocks(
  context: BrowserContext,
  articleHandler: (route: Route) => Promise<void>,
): Promise<void> {
  await context.route("**/api/v1/hospital/articles**", articleHandler);
  await context.route("**/api/v1/hospital/health-questions**", async (route) => {
    expect(route.request().headers()["authorization"]).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([PUBLISHED_QUESTION]),
    });
  });
  await installMockBrowserSession(context, null);
}

test("disease hub exposes reviewed guides and published Q&A while excluding GENERAL content", async ({ context, page }) => {
  await installDiseaseHubMocks(context, async (route) => {
    const url = new URL(route.request().url());
    expect(route.request().method()).toBe("GET");
    expect(route.request().headers()["authorization"]).toBeUndefined();
    expect(url.searchParams.get("contentKind")).toBe("DISEASE_GUIDE");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pageEnvelope([DISEASE_GUIDE, GENERAL_ARTICLE])),
    });
  });

  await page.goto("/benh-pho-bien");
  await expect(page.getByRole("heading", { name: "Hiểu đúng để biết khi nào nên đi khám" })).toBeVisible();
  await expect(page.getByRole("heading", { name: DISEASE_GUIDE.title })).toBeVisible();
  await expect(page.getByText(GENERAL_ARTICLE.title)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: PUBLISHED_QUESTION.question })).toBeVisible();
  await expect(page.getByText(PUBLISHED_QUESTION.answer ?? "", { exact: true })).toBeVisible();

  await page.getByLabel("Từ khóa tìm kiếm").fill("huyết áp");
  await expect(page.getByText("1 bài hướng dẫn · 1 câu hỏi đã xuất bản")).toBeVisible();
  await page.getByRole("button", { name: "Báo cáo nội dung" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Hãy đăng nhập bằng tài khoản bệnh nhân" })).toBeVisible();
  await assertNoSensitiveBrowserStorage(page, [PUBLISHED_QUESTION.question, PUBLISHED_QUESTION.answer ?? ""]);
});

test("article outage remains section-scoped, retries safely, and never renders raw provider or PHI details", async ({ context, page }) => {
  const rawLeak = "patient_email=secret@example.com upstream=http://spring-backend.internal:8080";
  let articleRequests = 0;
  await installDiseaseHubMocks(context, async (route) => {
    articleRequests += 1;
    if (articleRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "CATALOG_UPSTREAM_FAILURE", message: rawLeak, stack: "ProviderStackTrace" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pageEnvelope([DISEASE_GUIDE])),
    });
  });

  await page.goto("/benh-pho-bien");
  await expect(page.getByRole("heading", { name: PUBLISHED_QUESTION.question })).toBeVisible();
  await expect(page.getByRole("alert").filter({
    hasText: "Hệ thống đang tạm gián đoạn. Vui lòng thử lại sau.",
  })).toBeVisible();
  let bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("secret@example.com");
  expect(bodyText).not.toContain("spring-backend.internal");
  expect(bodyText).not.toContain("ProviderStackTrace");

  await page.getByRole("button", { name: "Thử tải lại hướng dẫn" }).click();
  await expect(page.getByRole("heading", { name: DISEASE_GUIDE.title })).toBeVisible();
  await expect(page.getByRole("alert").filter({
    hasText: "Hệ thống đang tạm gián đoạn. Vui lòng thử lại sau.",
  })).toHaveCount(0);
  expect(articleRequests).toBe(2);
  bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain(rawLeak);
});

test("disease detail refuses a GENERAL article instead of inheriting the clinical trust label", async ({ context, page }) => {
  await context.route(`**/api/v1/hospital/articles/${GENERAL_ARTICLE.slug}`, async (route) => {
    expect(route.request().headers()["authorization"]).toBeUndefined();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(GENERAL_ARTICLE) });
  });
  await installMockBrowserSession(context, null);

  await page.goto(`/benh-pho-bien/${GENERAL_ARTICLE.slug}`);
  await expect(page.getByText("Không tìm thấy hướng dẫn này trong kho nội dung đã được kiểm duyệt.")).toBeVisible();
  await expect(page.getByRole("heading", { name: GENERAL_ARTICLE.title })).toHaveCount(0);
  await expect(page.getByText("Nguồn bệnh viện được bác sĩ nội bộ duyệt", { exact: true })).toHaveCount(0);
});
