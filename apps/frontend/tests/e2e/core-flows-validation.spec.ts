import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type {
  AiChatExchange,
  AiChatMessage,
  AiChatMessagePage,
  AiConversation,
  Article,
  Branch,
  Doctor,
  HealthPackage,
  MedicalService,
  Specialty,
  TimeSlot,
} from "../../types/hospital";
import {
  browserSessionFixture,
  installMockBrowserSession,
  installMockPatientPortalSession,
} from "./helpers/browser-session";

// ════════════════════════════════════════════════════════════════════════════
// FIXTURES & DATA SEEDS
// ════════════════════════════════════════════════════════════════════════════

const PATIENT_SESSION = browserSessionFixture("PATIENT", "patient-e2e-val", "Nguyễn Văn An");

const BRANCH_1: Branch = {
  id: "branch-district-1",
  name: "HealthCare Quận 1",
  slug: "healthcare-quan-1",
  address: "01 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
  phone: "02812345678",
  workingHours: "Thứ 2 - Thứ 7: 07:30 - 17:00",
  active: true,
};

const SPECIALTY_CARDIO: Specialty = {
  id: "spec-cardio",
  name: "Tim mạch chuyên sâu",
  slug: "tim-mach",
  description: "Khám, chẩn đoán và điều trị bệnh lý mạch vành, tăng huyết áp và loạn nhịp.",
  active: true,
};

const SPECIALTY_PEDIATRICS: Specialty = {
  id: "spec-pediatrics",
  name: "Nhi khoa toàn diện",
  slug: "nhi-khoa",
  description: "Chăm sóc và điều trị chuyên sâu cho trẻ sơ sinh, trẻ nhỏ và thiếu niên.",
  active: true,
};

const DOCTOR_CARDIO: Doctor = {
  id: "doc-cardio",
  fullName: "BS.CKII Nguyễn Minh",
  slug: "nguyen-minh",
  title: "Bác sĩ Chuyên khoa Tim mạch",
  specialtyName: SPECIALTY_CARDIO.name,
  specialtySlugs: [SPECIALTY_CARDIO.slug],
  branchId: BRANCH_1.id,
  branchIds: [BRANCH_1.id],
  branchNames: [BRANCH_1.name],
  bio: "Hơn 15 năm kinh nghiệm trong can thiệp và điều trị bệnh mạch vành.",
  active: true,
};

const DOCTOR_PEDIATRICS: Doctor = {
  id: "doc-pediatrics",
  fullName: "ThS.BS Lê Thị Nhi",
  slug: "le-thi-nhi",
  title: "Bác sĩ Chuyên khoa Nhi",
  specialtyName: SPECIALTY_PEDIATRICS.name,
  specialtySlugs: [SPECIALTY_PEDIATRICS.slug],
  branchId: BRANCH_1.id,
  branchIds: [BRANCH_1.id],
  branchNames: [BRANCH_1.name],
  bio: "Bác sĩ đầu ngành nhi khoa với nhiều đề tài nghiên cứu lâm sàng.",
  active: true,
};

const PACKAGE_CARDIO: HealthPackage = {
  id: "pkg-cardio",
  name: "Gói khám tim mạch tổng quát",
  slug: "goi-kham-tim-mach-tong-quat",
  price: 2500000,
  description: "Tầm soát chuyên sâu nguy cơ đột quỵ và các bệnh lý tim mạch sớm.",
  targetAudience: "Người lớn từ 30 tuổi trở lên hoặc có tiền sử tim mạch",
  durationDays: 1,
  active: true,
  checklist: [
    "Khám lâm sàng tim mạch",
    "Điện tâm đồ gắng sức ECG",
    "Siêu âm tim Doppler màu",
    "Xét nghiệm bộ mỡ máu Lipid",
  ],
  preparationSteps: [
    "Nhịn ăn sáng trước khi lấy máu xét nghiệm",
    "Mang theo danh sách thuốc tim mạch đang uống",
  ],
};

const PACKAGE_PEDIATRICS: HealthPackage = {
  id: "pkg-pediatrics",
  name: "Gói tầm soát sức khỏe nhi khoa",
  slug: "goi-tam-soat-nhi-khoa",
  price: 1800000,
  description: "Đánh giá toàn diện thể chất, chiều cao, dinh dưỡng cho trẻ nhỏ.",
  targetAudience: "Trẻ em từ 1 đến 15 tuổi",
  durationDays: 1,
  active: true,
  checklist: [
    "Khám tổng quát nhi khoa",
    "Đánh giá dinh dưỡng và chỉ số BMI",
    "Xét nghiệm vi chất dinh dưỡng",
  ],
  preparationSteps: [
    "Mang theo sổ theo dõi tiêm chủng của bé",
  ],
};

const SERVICE_CARDIO: MedicalService = {
  id: "srv-cardio",
  name: "Siêu âm tim Doppler màu",
  slug: "sieu-am-tim-doppler",
  description: "Đánh giá hình thái và chức năng van tim qua siêu âm chuyên dụng.",
  active: true,
};

const ARTICLE_CARDIO: Article = {
  id: "art-cardio",
  title: "5 dấu hiệu cảnh báo bệnh tim mạch chớ bỏ qua",
  slug: "5-dau-hieu-canh-bao-benh-tim-mach",
  summary: "Nhận biết sớm dấu hiệu đau thắt ngực, hồi hộp, khó thở để xử lý an toàn.",
  body: "Nội dung bài viết về tim mạch chuyên sâu...",
  authorName: "BS.CKII Nguyễn Minh",
  category: "Tim mạch",
  publishedAt: "2026-08-10",
  active: true,
};

const TIME_SLOT: TimeSlot = {
  branchId: BRANCH_1.id,
  startTime: "08:00:00",
  endTime: "08:30:00",
  available: true,
  statusNote: "Còn trống",
};

function pageEnvelope<T>(content: T[] = []) {
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

function persistedExchangeSse(exchange: AiChatExchange): string {
  const answer = exchange.assistantMessage.content ?? "";
  const delta = answer
    .split(/\r?\n/)
    .map((line) => `data: ${line}`)
    .join("\n");
  return `event: delta\n${delta}\n\nevent: done\ndata: ${JSON.stringify(exchange)}\n\n`;
}

// ════════════════════════════════════════════════════════════════════════════
// FLOW 1: PATIENT CHAT AI (/patient/chat)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Flow 1: Patient Chat AI (/patient/chat)", () => {
  test("composer textarea and send button visibility, enabled state, switching conversations, scroll behavior, and quota deduction", async ({
    context,
  }) => {
    let currentCredits = 12;

    const convo1: AiConversation = {
      id: "convo-1",
      title: "Hỏi đáp triệu chứng tim mạch",
      status: "ACTIVE",
      inFlight: false,
      createdAt: "2026-08-20T08:00:00Z",
      updatedAt: "2026-08-23T03:10:00Z",
      lastMessageAt: "2026-08-23T03:10:00Z",
      expiresAt: "2026-11-21T03:10:00Z",
    };

    const convo2: AiConversation = {
      id: "convo-2",
      title: "Chuẩn bị khám sức khỏe tổng quát",
      status: "ACTIVE",
      inFlight: false,
      createdAt: "2026-08-22T09:00:00Z",
      updatedAt: "2026-08-23T04:00:00Z",
      lastMessageAt: "2026-08-23T04:00:00Z",
      expiresAt: "2026-11-21T04:00:00Z",
    };

    let conversations = [convo1, convo2];

    const messagesConvo1: AiChatMessage[] = [
      {
        id: "msg-1-1",
        role: "USER",
        status: "COMPLETED",
        content: "Tôi có cảm giác hồi hộp nhẹ vào buổi sáng, có đáng lo không?",
        sequence: 1,
        disclaimer: null,
        provenance: null,
        citations: [],
        createdAt: "2026-08-23T03:00:00Z",
        completedAt: "2026-08-23T03:00:01Z",
      },
      {
        id: "msg-1-2",
        role: "ASSISTANT",
        status: "COMPLETED",
        content: "Hồi hộp nhẹ có thể do căng thẳng, dùng cà phê hoặc thiếu ngủ. Nếu kèm đau thắt ngực, bạn nên đến cơ sở tim mạch khám ngay.",
        sequence: 2,
        disclaimer: "Thông tin chỉ dùng tham khảo, không thay thế bác sĩ.",
        provenance: "remote_provider",
        citations: [{ source_type: "specialty", source_id: "spec-cardio", title: "Tim mạch chuyên sâu" }],
        createdAt: "2026-08-23T03:00:02Z",
        completedAt: "2026-08-23T03:00:05Z",
      },
    ];

    const messagesConvo2: AiChatMessage[] = [
      {
        id: "msg-2-1",
        role: "USER",
        status: "COMPLETED",
        content: "Khám gói tổng quát có cần nhịn ăn sáng không?",
        sequence: 1,
        disclaimer: null,
        provenance: null,
        citations: [],
        createdAt: "2026-08-23T04:00:00Z",
        completedAt: "2026-08-23T04:00:01Z",
      },
      {
        id: "msg-2-2",
        role: "ASSISTANT",
        status: "COMPLETED",
        content: "Có, bạn cần nhịn ăn từ 6-8 tiếng để kết quả xét nghiệm máu và đường huyết đạt độ chính xác cao nhất.",
        sequence: 2,
        disclaimer: "Thông tin chỉ dùng tham khảo, không thay thế bác sĩ.",
        provenance: "remote_provider",
        citations: [{ source_type: "package", source_id: "pkg-cardio", title: "Gói khám tim mạch tổng quát" }],
        createdAt: "2026-08-23T04:00:02Z",
        completedAt: "2026-08-23T04:00:05Z",
      },
    ];

    // Policy mock
    await context.route("**/api/v1/ai/chat-policy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          policyVersion: "2026-08-23",
          retentionDays: 90,
          consentText: "Tôi đồng ý dùng trợ lý sức khỏe.",
          limitationText: "Không thay thế bác sĩ.",
          remoteProviderEnabled: false,
        }),
      });
    });

    // Credit status mock
    await context.route("**/api/v1/patient/ai-credits/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tier: "STANDARD",
          credits: currentCredits,
          maxCredits: 20,
          history: [],
        }),
      });
    });

    // Conversations mock
    await context.route("**/api/v1/ai/conversations**", async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();

      if (url.pathname === "/api/v1/ai/conversations" && method === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(conversations) });
        return;
      }

      if (url.pathname === "/api/v1/ai/conversations" && method === "POST") {
        const newConvo: AiConversation = {
          id: `convo-${Date.now()}`,
          title: "Cuộc trò chuyện mới",
          status: "ACTIVE",
          inFlight: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastMessageAt: null,
          expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
        };
        conversations = [newConvo, ...conversations];
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(newConvo) });
        return;
      }

      const match = url.pathname.match(/^\/api\/v1\/ai\/conversations\/([^/]+)(?:\/(messages)(?:\/(stream))?)?$/);
      if (!match) {
        await route.fallback();
        return;
      }

      const [, conversationId, resource, streamResource] = match;

      if (!resource && method === "GET") {
        const found = conversations.find((c) => c.id === conversationId);
        await route.fulfill({
          status: found ? 200 : 404,
          contentType: "application/json",
          body: JSON.stringify(found ?? { code: "CONVERSATION_NOT_FOUND" }),
        });
        return;
      }

      if (resource === "messages" && method === "GET") {
        const messages = conversationId === "convo-1" ? messagesConvo1 : messagesConvo2;
        const page: AiChatMessagePage = {
          content: messages,
          nextCursor: null,
          hasMore: false,
        };
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(page) });
        return;
      }

      if (resource === "messages" && method === "POST") {
        const payload = route.request().postDataJSON() as { content: string };
        const userMsg: AiChatMessage = {
          id: `msg-user-${Date.now()}`,
          role: "USER",
          status: "COMPLETED",
          content: payload.content,
          sequence: 3,
          disclaimer: null,
          provenance: null,
          citations: [],
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        const assistantMsg: AiChatMessage = {
          id: `msg-ai-${Date.now()}`,
          role: "ASSISTANT",
          status: "COMPLETED",
          content: "Câu trả lời từ DeepSeek RAG: Hãy kiểm tra kỹ các thông tin hướng dẫn và chuẩn bị trước buổi khám.",
          sequence: 4,
          disclaimer: "Thông tin chỉ dùng tham khảo, không thay thế bác sĩ.",
          provenance: "remote_provider",
          citations: [{ source_type: "article", source_id: "art-cardio", title: "5 dấu hiệu cảnh báo bệnh tim mạch" }],
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };

        // Quota is charged strictly after AI response completes
        currentCredits = Math.max(0, currentCredits - 1);

        const exchange: AiChatExchange = {
          userMessage: userMsg,
          assistantMessage: assistantMsg,
          replayed: false,
        };

        if (streamResource === "stream") {
          await route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: persistedExchangeSse(exchange),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(exchange),
          });
        }
        return;
      }

      await route.fallback();
    });

    await installMockPatientPortalSession(context, PATIENT_SESSION);

    const page = await context.newPage();
    await page.goto("/patient/chat");

    // 1. Check composer textarea and send button visibility
    const composerTextarea = page.locator("#patient-chat-message");
    await expect(composerTextarea).toBeVisible();
    await expect(composerTextarea).toBeEnabled();

    const sendButton = page.locator('button[type="submit"]:has-text("Gửi tin nhắn")');
    await expect(sendButton).toBeVisible();

    // With empty textarea, send button is disabled
    await expect(sendButton).toBeDisabled();

    // Verify initial quota display (12 AI Credits)
    await expect(page.locator("text=AI Credit:").locator("..")).toContainText("12");

    // 2. Typing in textarea enables send button
    await composerTextarea.fill("Tôi cần lưu ý gì trước khi đi khám?");
    await expect(sendButton).toBeEnabled();

    // 3. Test switching conversations and scroll behavior
    const convoList = page.locator('aside[aria-label="Danh sách cuộc trò chuyện"]');
    await expect(convoList).toBeVisible();

    // Verify conversation list items
    await expect(page.getByRole("button", { name: /Chuẩn bị khám sức khỏe tổng quát/ })).toBeVisible();
    await page.getByRole("button", { name: /Chuẩn bị khám sức khỏe tổng quát/ }).click();

    // Verify thread switched: messages from convo-2 are displayed
    await expect(page.getByText("Khám gói tổng quát có cần nhịn ăn sáng không?")).toBeVisible();
    await expect(page.getByText("Có, bạn cần nhịn ăn từ 6-8 tiếng")).toBeVisible();

    // Check message viewport scroll container
    const messageViewport = page.locator('div[aria-label="Lịch sử tin nhắn"]');
    await expect(messageViewport).toBeVisible();
    const isScrollable = await messageViewport.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.overflowY === "auto" || style.overflowY === "scroll";
    });
    expect(isScrollable).toBe(true);

    // 4. Test sending message, receiving response, and verifying quota behavior
    await composerTextarea.fill("Trẻ em có cần nhịn ăn sáng trước khi làm xét nghiệm không?");
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // Verify assistant response appears
    await expect(page.getByText("Câu trả lời từ DeepSeek RAG")).toBeVisible();

    // Verify quota deduction: 12 - 1 = 11 credits
    expect(currentCredits).toBe(11);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 2: SEARCH PAGE (/search)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Flow 2: Search Page (/search)", () => {
  const installSearchMocks = async (context: BrowserContext) => {
    await installMockBrowserSession(context, null);

    await context.route("**/api/v1/hospital/branches?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([BRANCH_1]) });
    });
    await context.route("**/api/v1/hospital/specialties?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([SPECIALTY_CARDIO, SPECIALTY_PEDIATRICS]) });
    });
    await context.route("**/api/v1/hospital/doctors?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([DOCTOR_CARDIO, DOCTOR_PEDIATRICS]) });
    });
    await context.route("**/api/v1/hospital/packages?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([PACKAGE_CARDIO, PACKAGE_PEDIATRICS]) });
    });
    await context.route("**/api/v1/hospital/services?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([SERVICE_CARDIO]) });
    });
    await context.route("**/api/v1/hospital/articles?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([ARTICLE_CARDIO]) });
    });

    // Secondary semantic AI search simulates cold-start or offline error
    await context.route("**/api/v1/ai/search**", async (route) => {
      await route.fulfill({ status: 503, json: { code: "AI_SEARCH_UNAVAILABLE" } });
    });
  };

  test('search "Tim mạch" and "Nhi khoa" displays valid results without red error banner (.catalog-status--error)', async ({
    context,
  }) => {
    await installSearchMocks(context);

    const page = await context.newPage();
    await page.goto("/search?q=Tim+m%E1%BA%A1ch");

    // Verify results exist
    await expect(page.locator(".search-results__count")).toContainText("kết quả phù hợp");
    await expect(page.getByRole("heading", { name: "Chuyên khoa" })).toBeVisible();
    await expect(page.getByText("Tim mạch chuyên sâu")).toBeVisible();
    await expect(page.getByText("BS.CKII Nguyễn Minh")).toBeVisible();
    await expect(page.getByText("Gói khám tim mạch tổng quát")).toBeVisible();

    // CRITICAL: Red error banner MUST NOT be displayed when results exist!
    await expect(page.locator(".catalog-status--error")).toHaveCount(0);

    // Search "Nhi khoa"
    const searchInput = page.locator("#search-page-input");
    await searchInput.fill("Nhi khoa");
    await page.getByRole("button", { name: "Tìm kiếm" }).click();

    // Verify results for Nhi khoa
    await expect(page.getByText("Nhi khoa toàn diện")).toBeVisible();
    await expect(page.getByText("ThS.BS Lê Thị Nhi")).toBeVisible();
    await expect(page.getByText("Gói tầm soát sức khỏe nhi khoa")).toBeVisible();

    // CRITICAL: Red error banner MUST NOT appear
    await expect(page.locator(".catalog-status--error")).toHaveCount(0);
  });

  test('category filter tabs ("Tất cả", "Chuyên khoa", "Bác sĩ", "Gói khám", "Dịch vụ", "Bài viết")', async ({
    context,
  }) => {
    await installSearchMocks(context);

    const page = await context.newPage();
    await page.goto("/search?q=Tim+m%E1%BA%A1ch");

    const tabsList = page.locator(".search-category-tabs");
    await expect(tabsList).toBeVisible();

    // Verify all 6 category tabs
    const tabAll = page.getByRole("tab", { name: /Tất cả/ });
    const tabSpecialty = page.getByRole("tab", { name: /Chuyên khoa/ });
    const tabDoctor = page.getByRole("tab", { name: /Bác sĩ/ });
    const tabPackage = page.getByRole("tab", { name: /Gói khám/ });
    const tabService = page.getByRole("tab", { name: /Dịch vụ/ });
    const tabArticle = page.getByRole("tab", { name: /Bài viết/ });

    await expect(tabAll).toBeVisible();
    await expect(tabSpecialty).toBeVisible();
    await expect(tabDoctor).toBeVisible();
    await expect(tabPackage).toBeVisible();
    await expect(tabService).toBeVisible();
    await expect(tabArticle).toBeVisible();

    // Click "Chuyên khoa" tab: only Specialty section is shown
    await tabSpecialty.click();
    await expect(tabSpecialty).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Chuyên khoa" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bác sĩ" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Gói khám" })).toHaveCount(0);

    // Click "Bác sĩ" tab: only Doctor section is shown
    await tabDoctor.click();
    await expect(tabDoctor).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Bác sĩ" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chuyên khoa" })).toHaveCount(0);

    // Click "Gói khám" tab: only Package section is shown
    await tabPackage.click();
    await expect(tabPackage).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Gói khám" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bác sĩ" })).toHaveCount(0);

    // Click "Dịch vụ" tab: only Service section is shown
    await tabService.click();
    await expect(tabService).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Dịch vụ" })).toBeVisible();

    // Click "Bài viết" tab: only Article section is shown
    await tabArticle.click();
    await expect(tabArticle).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Cẩm nang y tế" })).toBeVisible();

    // Click "Tất cả" tab: all categories return
    await tabAll.click();
    await expect(page.getByRole("heading", { name: "Chuyên khoa" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bác sĩ" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gói khám" })).toBeVisible();
  });

  test('diacritic-insensitive search ("tim mach" matches "Tim mạch")', async ({
    context,
  }) => {
    await installSearchMocks(context);

    const page = await context.newPage();
    // Search without accents
    await page.goto("/search?q=tim+mach");

    // Verify it matches "Tim mạch" entities
    await expect(page.locator(".search-results__count")).toContainText("kết quả phù hợp");
    await expect(page.getByText("Tim mạch chuyên sâu")).toBeVisible();
    await expect(page.getByText("BS.CKII Nguyễn Minh")).toBeVisible();
    await expect(page.getByText("Gói khám tim mạch tổng quát")).toBeVisible();
    await expect(page.locator(".catalog-status--error")).toHaveCount(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 3: APPOINTMENT BOOKING (/dat-lich)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Flow 3: Appointment Booking (/dat-lich)", () => {
  test("complete 4-step booking flow: facility/slot -> contact info & hold slot -> OTP confirmation -> appointment code success screen", async ({
    context,
  }) => {
    await installMockBrowserSession(context, null);

    await context.route("**/api/v1/hospital/branches?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([BRANCH_1]) });
    });
    await context.route("**/api/v1/hospital/specialties?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([SPECIALTY_CARDIO]) });
    });
    await context.route("**/api/v1/hospital/doctors?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([DOCTOR_CARDIO]) });
    });
    await context.route(`**/api/v1/appointments/doctors/${DOCTOR_CARDIO.id}/slots?**`, async (route) => {
      await route.fulfill({ json: [TIME_SLOT] });
    });

    let holdSlotCalled = false;
    await context.route("**/api/v1/appointments/hold", async (route) => {
      holdSlotCalled = true;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body.fullName).toBe("Nguyễn Văn An");
      expect(body.phone).toBe("0901234567");
      expect(body.email).toBe("patient@example.com");
      expect(body.privacyConsent).toBe(true);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          bookingCode: "HC-E2E-0001",
          holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          otpExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          message: "Đã giữ chỗ và gửi OTP.",
          otpRequired: true,
        }),
      });
    });

    let confirmCalled = false;
    await context.route("**/api/v1/appointments/confirm", async (route) => {
      confirmCalled = true;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body.bookingCode).toBe("HC-E2E-0001");
      expect(body.otpCode).toBe("123456");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "apt-001",
          bookingCode: "HC-E2E-0001",
          appointmentCode: "HC-CONF-0001",
          patientName: "Nguyễn Văn An",
          patientPhone: "0901234567",
          patientEmail: "patient@example.com",
          doctorId: DOCTOR_CARDIO.id,
          doctorName: DOCTOR_CARDIO.fullName,
          doctorTitle: DOCTOR_CARDIO.title,
          specialtyName: SPECIALTY_CARDIO.name,
          branchName: BRANCH_1.name,
          branchAddress: BRANCH_1.address,
          appointmentDate: "2026-08-24",
          startTime: TIME_SLOT.startTime,
          endTime: TIME_SLOT.endTime,
          status: "CONFIRMED",
          paymentStatus: "UNPAID",
          reasonForVisit: "Tái khám định kỳ",
          hasInsurance: false,
          privacyConsentAt: new Date().toISOString(),
          privacyConsentVersion: "v1",
          createdAt: new Date().toISOString(),
        }),
      });
    });

    const page = await context.newPage();
    await page.goto("/dat-lich");

    // Verify inline booking container is rendered
    const inlineRegion = page.locator(".booking-page__inline");
    await expect(inlineRegion).toBeVisible();

    // Step 1: Selection flow
    await expect(page.getByLabel("Chuyên khoa")).toHaveValue(SPECIALTY_CARDIO.id);
    await page.getByRole("button", { name: /Tiếp tục: Chọn cơ sở/ }).click();
    await page.getByRole("button", { name: /Tiếp tục: Chọn bác sĩ/ }).click();
    await page.getByRole("button", { name: /Tiếp tục: Chọn ngày/ }).click();
    await page.getByRole("button", { name: /Xem khung giờ/ }).click();

    // Pick slot
    await expect(page.getByRole("button", { name: /08:00.*Còn trống/ })).toBeEnabled();
    await page.getByRole("button", { name: /Tiếp tục: Điền thông tin/ }).click();

    // Step 3: Contact Info & Hold Slot
    await page.getByLabel("Họ và tên bệnh nhân").fill("Nguyễn Văn An");
    await page.getByLabel("Số điện thoại liên hệ").fill("0901234567");
    await page.getByLabel("Email nhận mã OTP").fill("patient@example.com");
    await page.getByLabel("Triệu chứng hoặc lý do khám bệnh").fill("Tái khám định kỳ");
    await page.getByLabel(/Tôi đồng ý để HealthCare xử lý thông tin đặt lịch/).check();

    // Click "Giữ chỗ và nhận mã OTP"
    await page.getByRole("button", { name: "Giữ chỗ và nhận mã OTP" }).click();
    expect(holdSlotCalled).toBe(true);

    // Step 4: OTP Confirmation
    await expect(page.getByRole("heading", { name: "Xác nhận lịch hẹn bằng OTP" })).toBeVisible();
    await page.getByLabel("Nhập mã OTP 6 số xác thực").fill("123456");
    await page.getByRole("button", { name: "Hoàn tất đặt lịch khám" }).click();
    expect(confirmCalled).toBe(true);

    // Success Screen: verify appointment code and success header
    await expect(page.getByRole("heading", { name: "Đặt lịch khám thành công!" })).toBeVisible();
    await expect(page.getByText("HC-E2E-0001")).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 4: DEDICATED PACKAGE BOOKING (/packages & /packages/[slug])
// ════════════════════════════════════════════════════════════════════════════

test.describe("Flow 4: Dedicated Package Booking (/packages & /packages/[slug])", () => {
  const installPackageMocks = async (context: BrowserContext) => {
    await installMockBrowserSession(context, null);

    await context.route("**/api/v1/hospital/packages?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([PACKAGE_CARDIO, PACKAGE_PEDIATRICS]) });
    });

    await context.route(`**/api/v1/hospital/packages/${PACKAGE_CARDIO.slug}`, async (route) => {
      await route.fulfill({ json: PACKAGE_CARDIO });
    });

    await context.route("**/api/v1/hospital/branches?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([BRANCH_1]) });
    });

    await context.route("**/api/v1/hospital/doctors?**", async (route) => {
      await route.fulfill({ json: pageEnvelope([DOCTOR_CARDIO]) });
    });

    await context.route(`**/api/v1/appointments/doctors/${DOCTOR_CARDIO.id}/slots?**`, async (route) => {
      await route.fulfill({ json: [TIME_SLOT] });
    });

    await context.route("**/api/v1/appointments/hold", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body.packageId).toBe(PACKAGE_CARDIO.id);
      expect(body.fullName).toBe("Trần Thị Mai");
      expect(body.phone).toBe("0987654321");
      expect(body.email).toBe("mai.tran@example.com");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          bookingCode: "HC-PKG-8888",
          holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          otpExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          message: "Đã giữ chỗ gói khám và gửi mã OTP.",
          otpRequired: true,
          otpDeliveryStatus: "DELIVERED",
        }),
      });
    });

    await context.route("**/api/v1/appointments/confirm", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body.bookingCode).toBe("HC-PKG-8888");
      expect(body.otpCode).toBe("123456");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "apt-pkg-001",
          bookingCode: "HC-PKG-8888",
          appointmentCode: "HC-PKG-CONF-8888",
          patientName: "Trần Thị Mai",
          patientPhone: "0987654321",
          patientEmail: "mai.tran@example.com",
          branchName: BRANCH_1.name,
          branchAddress: BRANCH_1.address,
          appointmentDate: "2026-08-24",
          startTime: "08:00:00",
          endTime: "08:30:00",
          status: "CONFIRMED",
          paymentStatus: "UNPAID",
          packageName: PACKAGE_CARDIO.name,
          createdAt: new Date().toISOString(),
        }),
      });
    });
  };

  test('button "Đặt lịch với gói này" on /packages opens dedicated PackageBookingModal with immutable package and specialty omitted', async ({
    context,
  }) => {
    await installPackageMocks(context);

    const page = await context.newPage();
    await page.goto("/packages");

    // 1. Verify "Đặt lịch với gói này" button is present on package cards
    const bookButtons = page.getByRole("button", { name: "Đặt lịch với gói này" });
    await expect(bookButtons.first()).toBeVisible();

    // 2. Click "Đặt lịch với gói này" on first package
    await bookButtons.first().click();

    // 3. PackageBookingModal is open
    const modal = page.getByRole("dialog", { name: /Đặt lịch gói khám/i });
    await expect(modal).toBeVisible();

    // Verify package is immutable: shows package name in header
    await expect(modal.getByRole("heading", { name: PACKAGE_CARDIO.name })).toBeVisible();

    // Verify specialty selection is COMPLETELY OMITTED (no Chuyên khoa dropdown or step)
    await expect(modal.locator('select[name="specialtyId"]')).toHaveCount(0);
    await expect(modal.getByLabel("Chuyên khoa")).toHaveCount(0);
    await expect(modal.getByText("Bước 1 / 4")).toBeVisible();
    await expect(modal.getByRole("heading", { name: "Chọn cơ sở y tế thuận tiện nhất" })).toBeVisible();

    // Step 1: Branch selection
    await page.getByRole("button", { name: /Tiếp tục: Chọn ngày & giờ tiếp nhận/ }).click();

    // Step 2: Date & Slot selection
    await expect(modal.getByText("Bước 2 / 4")).toBeVisible();
    await expect(modal.getByRole("heading", { name: "Chọn ngày & khung giờ tiếp nhận" })).toBeVisible();
    await page.getByRole("button", { name: /Tiếp tục: Điền thông tin người khám/ }).click();

    // Step 3: Patient info
    await expect(modal.getByText("Bước 3 / 4")).toBeVisible();
    await modal.locator("#package-patient-name").fill("Trần Thị Mai");
    await modal.locator("#package-patient-phone").fill("0987654321");
    await modal.locator("#package-patient-email").fill("mai.tran@example.com");
    await modal.locator('input[type="checkbox"]').nth(1).check(); // privacy consent

    // Click "Giữ chỗ và nhận mã OTP"
    await modal.getByRole("button", { name: /Giữ chỗ và nhận mã OTP/ }).click();

    // Step 4: OTP Confirmation
    await expect(modal.getByText("Bước 4 / 4")).toBeVisible();
    await expect(modal.getByRole("heading", { name: "Xác nhận mã OTP đặt lịch" })).toBeVisible();
    await expect(modal.getByText("HC-PKG-8888")).toBeVisible();

    await modal.locator("#package-booking-otp").fill("123456");
    await modal.getByRole("button", { name: "Hoàn tất đặt lịch khám" }).click();

    // Success Screen
    await expect(modal.getByRole("heading", { name: "Đặt Lịch Gói Khám Thành Công!" })).toBeVisible();
    await expect(modal.getByText("PHIẾU ĐĂNG KÝ GÓI KHÁM ĐIỆN TỬ")).toBeVisible();
    await expect(modal.getByText("HC-PKG-8888")).toBeVisible();
  });

  test('button "Đặt lịch với gói này" on /packages/[slug] opens dedicated PackageBookingModal', async ({
    context,
  }) => {
    await installPackageMocks(context);

    const page = await context.newPage();
    await page.goto(`/packages/${PACKAGE_CARDIO.slug}`);

    // Verify detail page has "Đặt lịch với gói này"
    const bookButton = page.getByRole("button", { name: "Đặt lịch với gói này" }).first();
    await expect(bookButton).toBeVisible();
    await bookButton.click();

    // Verify PackageBookingModal opens
    const modal = page.getByRole("dialog", { name: /Đặt lịch gói khám/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("heading", { name: PACKAGE_CARDIO.name })).toBeVisible();

    // Specialty selection is completely omitted
    await expect(modal.getByLabel("Chuyên khoa")).toHaveCount(0);
  });
});
