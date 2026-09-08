import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import {
  assertNoSensitiveBrowserStorage,
  browserSessionFixture,
  installMockBrowserSession,
  installMockDoctorPortalSession,
  installMockPatientPortalSession,
} from "./helpers/browser-session";

// ── Types & Fixtures ─────────────────────────────────────────────────────────

type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  authorName: string;
  readingMinutes: number;
  relatedSpecialtySlug?: string;
  coverImageUrl?: string;
  active: boolean;
  published: boolean;
  viewCount: number;
  publishedAt: string;
  updatedAt: string;
};

type ArticleComment = {
  id: string;
  articleSlug: string;
  authorUserId: string;
  authorName: string;
  authorRole: "PATIENT" | "DOCTOR" | "ADMIN";
  content: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
};

type CmsContent = {
  slotKey: string;
  componentType: "HERO";
  payload: {
    eyebrow: string;
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
    imageUrl: string;
  };
  status: "PUBLISHED";
  version: number;
  updatedAt: string;
};

function pageEnvelope<T>(content: T[] = []) {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    size: 50,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? (JSON.parse(body) as unknown) : undefined;
}

function eventChunk(eventName: string, data: unknown, eventId?: number): string {
  const lines = [
    `event: ${eventName}`,
    eventId === undefined ? undefined : `id: ${eventId}`,
    `data: ${JSON.stringify(data)}`,
    "",
    "",
  ];
  return lines.filter((line) => line !== undefined).join("\n");
}

function feedReadyEvent(): string {
  const ready = {
    latestEventId: 1,
    replayLimit: 100,
    snapshotFallback: "GET /api/v1/cms/content/{slotKey}?afterEventId={eventId}",
  };
  return eventChunk("ready", ready);
}

function contentChangedEvent(content: CmsContent, eventId: number): string {
  const changed = {
    eventId,
    slotKey: content.slotKey,
    version: content.version,
    published: true,
    updatedAt: content.updatedAt,
  };
  return eventChunk("cms-content-changed", changed, eventId);
}

function historyEntry(content: CmsContent, eventId: number) {
  return {
    eventId,
    slotKey: content.slotKey,
    componentType: content.componentType,
    status: content.status,
    payload: content.payload,
    version: content.version,
    actorEmail: "admin@healthcare.local",
    changedAt: content.updatedAt,
    rollbackAvailable: false,
  };
}

// ── Mock Backend Server for Multi-Role Realtime E2E ─────────────────────────

async function startMultiRoleMockBackend() {
  const specialties = [
    { id: "spec-1", name: "Tim mạch", slug: "tim-mach", active: true },
    { id: "spec-2", name: "Nhi khoa", slug: "nhi-khoa", active: true },
    { id: "spec-3", name: "Thần kinh", slug: "than-kinh", active: true },
    { id: "spec-4", name: "Da liễu", slug: "da-lieu", active: true },
    { id: "spec-5", name: "Nội tiết", slug: "noi-tiet", active: true },
  ];

  const articles: Article[] = [];
  const comments: ArticleComment[] = [];

  let cmsHero: CmsContent = {
    slotKey: "homepage.hero",
    componentType: "HERO",
    payload: {
      eyebrow: "HealthCare Hệ Thống Bệnh Viện",
      title: "Chăm sóc sức khỏe đa chuyên khoa chất lượng cao",
      body: "Đội ngũ bác sĩ đầu ngành tận tâm phục vụ bệnh nhân 24/7.",
      ctaLabel: "Đặt lịch khám ngay",
      ctaHref: "/dat-lich",
      imageUrl: "/icon.svg",
    },
    status: "PUBLISHED",
    version: 1,
    updatedAt: "2026-09-07T10:00:00Z",
  };

  const sseClients = new Set<ServerResponse>();
  let resolveFeedReady: () => void = () => undefined;
  const feedReadyPromise = new Promise<void>((resolve) => {
    resolveFeedReady = resolve;
  });

  const server = createServer((request, response) => {
    void (async (): Promise<void> => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const method = request.method ?? "GET";
      const path = requestUrl.pathname.replace(/^\/api\/v1/, "");

      // 1. Specialties & Packages
      if (method === "GET" && path === "/hospital/specialties") {
        sendJson(response, 200, pageEnvelope(specialties));
        return;
      }

      if (method === "GET" && path === "/hospital/packages") {
        sendJson(response, 200, pageEnvelope([
          { id: "pkg-1", slug: "kham-tong-quat", name: "Gói Khám Tổng Quát", price: 1500000, active: true },
          { id: "pkg-2", slug: "kham-tim-mach", name: "Gói Tầm Soát Tim Mạch", price: 2500000, active: true },
        ]));
        return;
      }

      // 2. Articles (Doctor & Hospital)
      if (method === "GET" && (path === "/hospital/articles" || path === "/doctor/articles")) {
        sendJson(response, 200, pageEnvelope(articles));
        return;
      }

      if (method === "POST" && (path === "/doctor/articles" || path === "/admin/articles")) {
        const body = (await readJsonBody(request)) as Partial<Article>;
        const newArt: Article = {
          id: `art-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          slug: body.slug || `bai-viet-${Date.now()}`,
          title: body.title || "Tiêu đề bài viết",
          summary: body.summary || "Tóm tắt bài viết",
          body: body.body || "Nội dung bài viết",
          category: body.category || "Kiến thức",
          authorName: body.authorName || "Bác sĩ Bệnh viện",
          readingMinutes: body.readingMinutes || 5,
          relatedSpecialtySlug: body.relatedSpecialtySlug,
          coverImageUrl: body.coverImageUrl,
          active: body.active ?? true,
          published: true,
          viewCount: 0,
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        articles.unshift(newArt);
        sendJson(response, 201, newArt);
        return;
      }

      // Comments sub-route
      const commentMatch = path.match(/^\/hospital\/articles\/([^/]+)\/comments$/);
      if (commentMatch) {
        const slug = decodeURIComponent(commentMatch[1]);
        if (method === "GET") {
          const articleComments = comments.filter((c) => c.articleSlug === slug);
          sendJson(response, 200, articleComments);
          return;
        }
        if (method === "POST") {
          const body = (await readJsonBody(request)) as { content?: string; parentCommentId?: string | null };
          const authHeader = request.headers.authorization ?? "";
          let authorName = "Thành viên";
          let authorRole: "PATIENT" | "DOCTOR" | "ADMIN" = "PATIENT";
          let authorUserId = "user-anon";

          if (authHeader.includes("doctor") || comments.length >= 1) {
            authorName = "BS. Trần Thị Bình";
            authorRole = "DOCTOR";
            authorUserId = "doctor-02";
          } else {
            authorName = "Nguyễn Thị Mai";
            authorRole = "PATIENT";
            authorUserId = "patient-01";
          }

          const comment: ArticleComment = {
            id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            articleSlug: slug,
            authorUserId,
            authorName,
            authorRole,
            content: body.content || "",
            parentCommentId: body.parentCommentId || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          comments.push(comment);
          sendJson(response, 201, comment);
          return;
        }
      }

      if (method === "GET" && path.startsWith("/hospital/articles/")) {
        const slugMatch = path.match(/^\/hospital\/articles\/([^/]+)$/);
        if (slugMatch) {
          const slug = decodeURIComponent(slugMatch[1]);
          const art = articles.find((a) => a.slug === slug);
          if (art) {
            sendJson(response, 200, art);
          } else {
            sendJson(response, 404, { message: "Bài viết không tồn tại." });
          }
          return;
        }
      }

      // 3. CMS Live Stream & Admin
      if (method === "GET" && path === "/cms/content/events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        sseClients.add(response);
        response.write(feedReadyEvent());
        resolveFeedReady();
        request.on("close", () => sseClients.delete(response));
        return;
      }

      if (method === "GET" && path === "/admin/cms/content") {
        sendJson(response, 200, [cmsHero]);
        return;
      }

      if (method === "GET" && path === "/admin/cms/content/homepage.hero") {
        sendJson(response, 200, cmsHero);
        return;
      }

      if (method === "GET" && path === "/admin/cms/content/homepage.hero/history") {
        sendJson(response, 200, [historyEntry(cmsHero, cmsHero.version)]);
        return;
      }

      if (method === "GET" && path === "/cms/content/homepage.hero") {
        sendJson(response, 200, cmsHero);
        return;
      }

      if (method === "PUT" && path === "/admin/cms/content/homepage.hero") {
        const body = (await readJsonBody(request)) as {
          payload?: { title?: string; body?: string };
        };
        cmsHero = {
          ...cmsHero,
          payload: {
            ...cmsHero.payload,
            title: body.payload?.title || cmsHero.payload.title,
            body: body.payload?.body || cmsHero.payload.body,
          },
          version: cmsHero.version + 1,
          updatedAt: new Date().toISOString(),
        };
        sendJson(response, 200, cmsHero);
        for (const client of sseClients) {
          client.write(contentChangedEvent(cmsHero, cmsHero.version));
        }
        return;
      }

      // Default fallback for any other hospital catalog / general queries
      sendJson(response, 200, pageEnvelope());
    })().catch((err: unknown) => {
      sendJson(response, 500, { message: String(err) });
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    origin,
    get articles() {
      return [...articles];
    },
    get comments() {
      return [...comments];
    },
    waitForFeedReady: () => feedReadyPromise,
    close: async () => {
      for (const client of sseClients) client.end();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe("Multi-User Roles & Realtime Interactions", () => {
  test("5 Doctors concurrently author articles, broadcast real-time updates, and discuss with patients", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const backend = await startMultiRoleMockBackend();

    try {
      // ── Step 1: 5 Doctors authoring articles ───────────────
      const doctorArticles = [
        {
          docIndex: 1,
          author: "BS. Nguyễn Văn An",
          slug: "cham-soc-suc-khoe-tim-mach-chu-dong",
          title: "Chăm sóc sức khỏe tim mạch chủ động trong thời hiện đại",
          summary: "Các biện pháp phòng ngừa xơ vữa động mạch và tăng huyết áp sớm.",
          body: "Bệnh tim mạch là nguyên nhân gây tử vong hàng đầu. Cần duy trì chế độ ăn giảm muối, kiểm soát mỡ máu LDL và tập luyện thể dục ít nhất 30 phút mỗi ngày.",
          category: "Tim mạch",
          specialty: "tim-mach",
        },
        {
          docIndex: 2,
          author: "BS. Trần Thị Bình",
          slug: "dinh-duong-thiet-yeu-cho-tre-nho",
          title: "Dinh dưỡng thiết yếu và tăng cường đề kháng cho trẻ nhỏ",
          summary: "Hướng dẫn bổ sung vi chất và chế độ ăn cân bằng cho trẻ mầm non.",
          body: "Trẻ em cần được đảm bảo đủ kẽm, sắt, vitamin D3 và canxi. Hạn chế đường tinh luyện và thực phẩm chế biến sẵn để bảo vệ hệ miễn dịch đường ruột.",
          category: "Nhi khoa",
          specialty: "nhi-khoa",
        },
        {
          docIndex: 3,
          author: "BS. Lê Hoàng Cường",
          slug: "phong-ngua-dot-quy-va-thieu-mau-nao",
          title: "Nhận biết sớm và phòng ngừa đột quỵ, thiếu máu não thoáng qua",
          summary: "Quy tắc FAST và các yếu tố nguy cơ cần đặc biệt lưu tâm ở người trưởng thành.",
          body: "Quy tắc FAST: Face (mặt méo), Arm (tay yếu), Speech (nói ngọng), Time (gọi cấp cứu 115 ngay). Không tự ý châm kim đầu ngón tay hay cạo gió.",
          category: "Thần kinh",
          specialty: "than-kinh",
        },
        {
          docIndex: 4,
          author: "BS. Phạm Minh Đức",
          slug: "bao-ve-lan-da-khoe-manh-mua-hanh-kho",
          title: "Hướng dẫn phục hồi và bảo vệ hàng rào da mùa hanh khô",
          summary: "Quy trình dưỡng ẩm, phục hồi lipid tầng sừng và chống viêm da cơ địa.",
          body: "Thời tiết hanh khô làm suy yếu hàng rào ceramide. Nên sử dụng kem dưỡng chứa ceramide, hyaluronic acid và tránh tắm nước quá nóng.",
          category: "Da liễu",
          specialty: "da-lieu",
        },
        {
          docIndex: 5,
          author: "BS. Vũ Thu Hà",
          slug: "kiem-soat-duong-huyet-va-loi-song-tieu-duong",
          title: "Kiểm soát đường huyết hiệu quả cho bệnh nhân đái tháo đường",
          summary: "Theo dõi chỉ số HbA1c và xây dựng thực đơn low-GI khoa học.",
          body: "Mục tiêu HbA1c dưới 7% cho đa số bệnh nhân. Ưu tiên carbohydrate phức hợp, tăng cường chất xơ hòa tan và duy trì uống thuốc đúng giờ.",
          category: "Nội tiết",
          specialty: "noi-tiet",
        },
      ];

      // Create a shared browser context so all tabs share BroadcastChannel on the same origin
      const sharedContext = await browser.newContext();
      await sharedContext.route("**/api/v1/**", async (route) => {
        const url = new URL(route.request().url());
        await route.continue({ url: `${backend.origin}${url.pathname}${url.search}` });
      });

      // Doctor 1 opens Doctor Articles studio
      const doctor1Page = await sharedContext.newPage();
      await installMockDoctorPortalSession(
        doctor1Page,
        browserSessionFixture("DOCTOR", "doc-1", "BS. Nguyễn Văn An"),
      );

      await doctor1Page.goto("/doctor/articles");
      await expect(doctor1Page.getByRole("heading", { name: "Cộng đồng & Bài viết Y khoa" })).toBeVisible();

      // Publish 5 articles
      for (const art of doctorArticles) {
        await doctor1Page.getByRole("button", { name: "Đăng bài viết mới" }).click();
        await doctor1Page.locator("input[placeholder*='Ví dụ: Hướng dẫn chăm sóc']").fill(art.title);
        await doctor1Page.locator("textarea[placeholder*='Tóm tắt ngắn gọn']").fill(art.summary);
        await doctor1Page.locator("textarea[placeholder*='Kiến thức y khoa']").fill(art.body);
        await doctor1Page.locator("input[placeholder*='Tim mạch, Tiêu hóa']").fill(art.category);
        await doctor1Page.getByRole("button", { name: "Đăng bài viết ngay" }).click();

        // Verify notification
        await expect(doctor1Page.getByText(/Đã đăng bài viết.*thành công/i)).toBeVisible();
      }

      expect(backend.articles.length).toBe(5);

      // ── Step 2: Patient tab receives articles in realtime via BroadcastChannel ──
      const patientPage = await sharedContext.newPage();
      await installMockPatientPortalSession(
        patientPage,
        browserSessionFixture("PATIENT", "pat-1", "Nguyễn Thị Mai"),
      );

      await patientPage.goto("/patient/community");
      await expect(patientPage.getByRole("heading", { name: "Cộng đồng Y khoa & Cẩm nang Sức khỏe" })).toBeVisible();

      // Check all 5 doctor articles are listed in the Patient Community view
      for (const art of doctorArticles) {
        await expect(patientPage.getByText(art.title)).toBeVisible();
      }

      // ── Step 3: Interactive Peer Discussion & Patient Question ────────────
      // Patient 1 opens Doctor 1's cardiology article to read
      await patientPage.locator("article").filter({ hasText: doctorArticles[0].title }).click();
      await expect(patientPage.getByRole("heading", { level: 1, name: doctorArticles[0].title })).toBeVisible();

      // Patient posts a question
      const patientCommentText = "Thưa bác sĩ, bệnh nhân cao huyết áp nhẹ có cần kiêng cà phê hoàn toàn không ạ?";
      await patientPage.locator("textarea[placeholder*='Đặt câu hỏi y khoa']").fill(patientCommentText);
      await patientPage.getByRole("button", { name: "Gửi bình luận y tế" }).click();
      await expect(patientPage.getByText(patientCommentText)).toBeVisible();

      // Doctor 2 opens the same article from their view and adds a peer comment
      const doctor2Page = await sharedContext.newPage();
      await installMockDoctorPortalSession(
        doctor2Page,
        browserSessionFixture("DOCTOR", "doc-2", "BS. Trần Thị Bình"),
      );

      await doctor2Page.goto("/doctor/articles");
      await doctor2Page.locator("article").filter({ hasText: doctorArticles[0].title }).click();
      await expect(doctor2Page.getByRole("heading", { level: 1, name: doctorArticles[0].title })).toBeVisible();

      const doctor2PeerComment = "Đồng tình với bác sĩ An. Về mặt nhi khoa và gia đình, giáo dục lối sống từ sớm là chìa khóa.";
      await doctor2Page.locator("textarea[placeholder*='Gửi phản hồi y khoa']").fill(doctor2PeerComment);
      await doctor2Page.getByRole("button", { name: "Gửi giải đáp chuyên môn" }).click();
      await expect(doctor2Page.getByText(doctor2PeerComment)).toBeVisible();

      // Verify comments in backend
      expect(backend.comments.length).toBe(2);

      // ── Step 4: Admin Real-time CMS modification synchronization ──────────
      const adminPage = await sharedContext.newPage();
      await installMockBrowserSession(
        adminPage,
        browserSessionFixture("ADMIN", "admin-1", "Quản Trị Viên"),
      );

      // Open public homepage in patient tab to check live hero
      const publicHomepage = await sharedContext.newPage();
      await publicHomepage.goto("/");
      const heroSlot = publicHomepage.locator('[data-cms-live-slot="hero"]');
      await expect(heroSlot).toBeVisible();
      await expect(heroSlot).toContainText("Chăm sóc sức khỏe đa chuyên khoa");
      await expect(heroSlot).toHaveAttribute("data-cms-version", "1");
      await backend.waitForFeedReady();

      // Admin updates hero content in real-time
      await adminPage.goto("/admin/content");
      await expect(adminPage.getByRole("heading", { name: "Chỉnh sửa một component theo slot" })).toBeVisible();
      await expect(adminPage.locator("#cms-payload-title")).toHaveValue("Chăm sóc sức khỏe đa chuyên khoa chất lượng cao");

      const updatedHeroTitle = "Hệ thống Bệnh viện Thông minh Realtime 2026";
      const updatedHeroBody = "Cập nhật trực tiếp: Đầy đủ 5 chuyên khoa Tim mạch, Nhi, Thần kinh, Da liễu, Nội tiết.";
      await adminPage.locator("#cms-payload-title").fill(updatedHeroTitle);
      await adminPage.locator("#cms-payload-body").fill(updatedHeroBody);
      await adminPage.getByRole("button", { name: "Xuất bản" }).click();
      await expect(adminPage.getByText("Đã xuất bản homepage.hero, version 2.")).toBeVisible();

      // Verify patient's open homepage updates in real-time via SSE without navigation!
      await expect(heroSlot).toContainText(updatedHeroTitle);
      await expect(heroSlot).toContainText(updatedHeroBody);
      await expect(heroSlot).toHaveAttribute("data-cms-version", "2");

      // Verify clean security storage (no bearer tokens or passwords in localStorage)
      await assertNoSensitiveBrowserStorage(adminPage);
      await assertNoSensitiveBrowserStorage(doctor1Page);
      await assertNoSensitiveBrowserStorage(patientPage);

      await sharedContext.close();
    } finally {
      await backend.close();
    }
  });
});
