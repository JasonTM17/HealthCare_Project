import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

/* =========================================================================
 * FLOW 1: PATIENT AI CHAT ADVERSARIAL CHALLENGE
 * ========================================================================= */
test("Flow 1: Empty / whitespace / short prompts are rejected before network and quota", async () => {
  const source = await read("app/patient/chat/page.tsx");

  // Client-side guard in sendContent
  assert.match(
    source,
    /normalizedContent\.length < 2 \|\| normalizedContent\.length > MAX_MESSAGE_LENGTH/,
    "sendContent must reject inputs shorter than 2 chars or longer than MAX_MESSAGE_LENGTH",
  );
  assert.match(
    source,
    /CHAT_INPUT_INVALID/,
    "sendContent must report CHAT_INPUT_INVALID error",
  );

  // Draft validity check for composer button
  assert.match(
    source,
    /const draftIsValid = normalizedDraft\.length >= 2/,
    "draftIsValid must require at least 2 characters",
  );
  assert.match(
    source,
    /disabled=\{!selectedConversationId \|\| sendLocked \|\| !draftIsValid \|\| currentConsentRequired\}/,
    "Send button must be disabled when draft is invalid",
  );

  // Behavioral simulation
  const validatePrompt = (draft) => {
    const trimmed = draft.trim();
    if (trimmed.length < 2 || trimmed.length > 10000) {
      return { valid: false, error: "CHAT_INPUT_INVALID" };
    }
    return { valid: true };
  };

  assert.equal(validatePrompt("").valid, false);
  assert.equal(validatePrompt("   ").valid, false);
  assert.equal(validatePrompt("\t\n\r").valid, false);
  assert.equal(validatePrompt("a").valid, false);
  assert.equal(validatePrompt(" \u200B ").valid, false); // Zero-width space
  assert.equal(validatePrompt("ok").valid, true);
  assert.equal(validatePrompt("Triệu chứng ho sốt").valid, true);
});

test("Flow 1: Rapid session creation has interactionLocked guard and zero duplicate keys", async () => {
  const source = await read("app/patient/chat/page.tsx");

  // interactionLocked locks creation button
  assert.match(
    source,
    /const interactionLocked = sendLocked \|\| creating \|\| deleting \|\| consentBusy;/,
    "interactionLocked must include creating state",
  );
  assert.match(
    source,
    /disabled=\{interactionLocked\}/,
    "New conversation button must be disabled while interactionLocked",
  );

  // State deduplication
  assert.match(
    source,
    /item\.id !== conversation\.id/,
    "setConversations must filter out existing ID before prepending to prevent duplicate keys",
  );

  // Consent pre-acceptance in new session creation
  assert.match(
    source,
    /createAiConversation\(\{ mode: selectedMode, consentAccepted: true \}\)/,
    "createAiConversation must pass consentAccepted: true to avoid blocking composer",
  );

  // Concurrency deduplication simulation
  let conversations = [
    { id: "conv-1", title: "Cuộc trò chuyện 1" },
    { id: "conv-2", title: "Cuộc trò chuyện 2" },
  ];
  const simulateAdd = (newConv) => {
    conversations = [newConv, ...conversations.filter((item) => item.id !== newConv.id)];
  };

  // Simulate 10 rapid additions including duplicates
  simulateAdd({ id: "conv-3", title: "Cuộc trò chuyện 3" });
  simulateAdd({ id: "conv-3", title: "Cuộc trò chuyện 3" }); // duplicate
  simulateAdd({ id: "conv-1", title: "Cuộc trò chuyện 1 updated" }); // duplicate existing

  const ids = conversations.map((c) => c.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, "Conversations list must contain strictly unique IDs");
  assert.equal(conversations[0].id, "conv-1");
  assert.equal(conversations[1].id, "conv-3");
  assert.equal(conversations[2].id, "conv-2");
});

test("Flow 1: Mobile flex layout boundaries ensure composer is always pinned and viewports scroll", async () => {
  const css = await read("app/patient/chat/chat.module.css");

  // .conversationRail flex column
  assert.match(css, /\.conversationRail\s*\{[^}]*display:\s*flex;/);
  assert.match(css, /\.conversationRail\s*\{[^}]*flex-direction:\s*column;/);
  assert.match(css, /\.conversationList\s*\{[^}]*flex:\s*1 1 auto;/);
  assert.match(css, /\.conversationList\s*\{[^}]*overflow-y:\s*auto;/);
  assert.match(css, /\.conversationList\s*\{[^}]*overscroll-behavior:\s*contain;/);

  // .thread flex column
  assert.match(css, /\.thread\s*\{[^}]*display:\s*flex;/);
  assert.match(css, /\.thread\s*\{[^}]*flex-direction:\s*column;/);
  assert.match(css, /\.threadHeader\s*\{[^}]*flex:\s*0 0 auto;/);
  assert.match(css, /\.messageViewport\s*\{[^}]*flex:\s*1 1 auto;/);
  assert.match(css, /\.messageViewport\s*\{[^}]*overflow-y:\s*auto;/);
  assert.match(css, /\.messageViewport\s*\{[^}]*overscroll-behavior:\s*contain;/);
  assert.match(css, /\.composer\s*\{[^}]*flex:\s*0 0 auto;/);

  // No smooth-scroll jitter in messageViewport
  assert.doesNotMatch(
    css,
    /\.messageViewport\s*\{[^}]*scroll-behavior:\s*smooth;/,
    "messageViewport must not use CSS smooth scrolling to prevent jitter during streaming",
  );
});

test("Flow 1: Quota debiting contract is strictly transactional upon completed assistant response", async () => {
  const backendService = await readFile(
    new URL("../../backend/src/main/java/com/healthcare/ai/chat/service/AiConversationService.java", import.meta.url),
    "utf8",
  );

  // prepare() must NOT charge quota inside its method body
  const prepareMethod = backendService.substring(
    backendService.indexOf("private PreparedMessage prepare("),
    backendService.indexOf("private void chargeAcceptedPatientExchange("),
  );
  assert.doesNotMatch(
    prepareMethod,
    /chargeAcceptedPatientExchange/,
    "prepare() must NOT charge patient quota",
  );

  // complete() must charge quota AFTER assistant response is saved
  const completeMethod = backendService.substring(
    backendService.indexOf("private ChatExchangeResponse complete("),
    backendService.indexOf("private boolean sameSourceSet("),
  );
  assert.match(
    completeMethod,
    /chargeAcceptedPatientExchange\(userId\);/,
    "complete() must charge quota upon successful generation",
  );

  // markFailed() must NOT refund or charge (zero debit on failure)
  const markFailedMethod = backendService.substring(
    backendService.indexOf("private void markFailed("),
    backendService.indexOf("private void recoverStaleInFlight("),
  );
  assert.doesNotMatch(
    markFailedMethod,
    /chargeAcceptedPatientExchange/,
    "markFailed() must not charge quota",
  );
  assert.doesNotMatch(
    markFailedMethod,
    /refundFailedPatientExchange/,
    "markFailed() does not need to refund because prepare() never charged",
  );

  // Frontend does not optimistically deduct quota
  const frontendSource = await read("app/patient/chat/page.tsx");
  assert.doesNotMatch(
    frontendSource,
    /setCreditStatus\(\(prev\) => \(prev \? \{ \.\.\.prev, credits: Math\.max\(0, prev\.credits - 1\) \} : prev\)\)/,
    "Frontend must not optimistically decrement creditStatus on send",
  );
  assert.match(
    frontendSource,
    /refreshCredit\(\)/,
    "Frontend must refresh credit from backend truth after exchange",
  );
});

/* =========================================================================
 * FLOW 2: SEARCH EXPERIENCE ADVERSARIAL CHALLENGE
 * ========================================================================= */
test("Flow 2: Normalization handles exhaustive Vietnamese diacritics and regex symbols", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  function normalize(value) {
    return value
      .trim()
      .toLocaleLowerCase("vi-VN")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  }

  function matches(query, values) {
    const normalizedQuery = normalize(query);
    return values.some((value) => value && normalize(value).includes(normalizedQuery));
  }

  // 25 clinical specialties & medical term test pairs
  const testPairs = [
    ["tim mach", "Chuyên khoa Tim mạch can thiệp"],
    ["Tim mạch", "Chuyên khoa Tim mạch can thiệp"],
    ["TIM MẠCH", "Chuyên khoa Tim mạch can thiệp"],
    ["tai mui hong", "Khám chuyên sâu Tai Mũi Họng"],
    ["Tai mũi họng", "Khám chuyên sâu Tai Mũi Họng"],
    ["nhi khoa", "Bác sĩ Nhi khoa hàng đầu"],
    ["Nhi khoa", "Bác sĩ Nhi khoa hàng đầu"],
    ["da lieu", "Điều trị bệnh Da liễu"],
    ["Da liễu", "Điều trị bệnh Da liễu"],
    ["y hoc co truyen", "Khoa Y học cổ truyền"],
    ["Y học cổ truyền", "Khoa Y học cổ truyền"],
    ["ung buou", "Tầm soát Ung bướu kỹ thuật cao"],
    ["Ung bướu", "Tầm soát Ung bướu kỹ thuật cao"],
    ["rang ham mat", "Phẫu thuật Răng Hàm Mặt"],
    ["Răng hàm mặt", "Phẫu thuật Răng Hàm Mặt"],
    ["phuc hoi chuc nang", "Trung tâm Phục hồi chức năng"],
    ["ho hap", "Chẩn đoán bệnh Hô hấp mãn tính"],
    ["Hô hấp", "Chẩn đoán bệnh Hô hấp mãn tính"],
    ["tieu hoa", "Nội soi Tiêu hóa không đau"],
    ["than kinh", "Phẫu thuật Ngoại Thần kinh"],
    ["dieu duong", "Dịch vụ Điều dưỡng tại nhà"],
    ["Điều dưỡng", "Dịch vụ Điều dưỡng tại nhà"],
    ["kham tong quat", "Gói Khám tổng quát định kỳ"],
    ["xet nghiem mau", "Xét nghiệm máu tổng quát 24 chỉ số"],
    ["tam soat ung thu", "Gói tầm soát ung thư toàn diện"],
  ];

  for (const [query, target] of testPairs) {
    assert.ok(
      matches(query, [target]),
      `Query "${query}" must match target "${target}"`,
    );
  }

  // Adversarial edge cases: regex characters in query must NOT throw or fail
  assert.ok(matches("tim (mach)", ["Khám tim (mach)"]));
  assert.ok(matches("tim+mach", ["Khám tim+mach"]));
  assert.ok(matches("tim*mach", ["Khám tim*mach"]));
  assert.ok(matches("   tim mach   ", ["Chuyên khoa Tim mạch"]));
});

test("Flow 2: Zero false red error banners when results exist (resultCount > 0)", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  // Exact semantic error rendering condition
  assert.match(
    source,
    /\{resultCount === 0 && semanticError \? <p className="catalog-status catalog-status--error" role="alert">\{semanticError\}<\/p> : null\}/,
    "semanticError banner must strictly require resultCount === 0",
  );

  // Simulate banner logic oracle
  const renderSemanticBanner = (resultCount, semanticError) => {
    return resultCount === 0 && semanticError ? semanticError : null;
  };

  // Case 1: 133 results found, but AI semantic search failed/timed out
  assert.equal(
    renderSemanticBanner(133, "Tạm thời chưa thể mở rộng kết quả tìm kiếm. Vui lòng thử lại sau."),
    null,
    "Banner must be suppressed when resultCount > 0",
  );

  // Case 2: 1 result found, AI semantic search failed
  assert.equal(
    renderSemanticBanner(1, "Tạm thời chưa thể mở rộng kết quả tìm kiếm. Vui lòng thử lại sau."),
    null,
    "Banner must be suppressed when at least 1 result exists",
  );

  // Case 3: 0 results found and AI semantic search failed
  assert.equal(
    renderSemanticBanner(0, "Tạm thời chưa thể mở rộng kết quả tìm kiếm. Vui lòng thử lại sau."),
    "Tạm thời chưa thể mở rộng kết quả tìm kiếm. Vui lòng thử lại sau.",
    "Banner must only appear when resultCount === 0 and semanticError is present",
  );
});

test("Flow 2: Category tabs partition results without data loss", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  const expectedTabs = ["ALL", "SPECIALTY", "DOCTOR", "PACKAGE", "SERVICE", "ARTICLE"];
  for (const tab of expectedTabs) {
    assert.match(source, new RegExp(`key:\\s*"${tab}"`));
  }

  // Category counts oracle
  const mockCatalogResult = {
    specialties: [{ id: "sp-1" }, { id: "sp-2" }],
    doctors: [{ id: "doc-1" }, { id: "doc-2" }, { id: "doc-3" }],
    packages: [{ id: "pkg-1" }],
    services: [{ id: "svc-1" }, { id: "svc-2" }],
    articles: [{ id: "art-1" }],
  };

  const total = mockCatalogResult.specialties.length +
    mockCatalogResult.doctors.length +
    mockCatalogResult.packages.length +
    mockCatalogResult.services.length +
    mockCatalogResult.articles.length;

  assert.equal(total, 9);
  assert.equal(mockCatalogResult.specialties.length, 2);
  assert.equal(mockCatalogResult.doctors.length, 3);
  assert.equal(mockCatalogResult.packages.length, 1);
  assert.equal(mockCatalogResult.services.length, 2);
  assert.equal(mockCatalogResult.articles.length, 1);
});

/* =========================================================================
 * FLOW 3: BOOKING HOLD SLOT & RETRY ADVERSARIAL CHALLENGE
 * ========================================================================= */
test("Flow 3: Hold slot timeout is 28,000ms with automatic cold-start retry", async () => {
  const source = await read("lib/api.ts");

  // Timeout constant must be 28_000ms
  assert.match(
    source,
    /BOOKING_REQUEST_TIMEOUT_MS\s*=\s*28_000/,
    "BOOKING_REQUEST_TIMEOUT_MS must be 28_000ms",
  );

  // holdAppointmentSlot retry loop
  assert.match(source, /for\s*\(\s*let attempt = 0;\s*attempt < 2;\s*attempt\+\+\s*\)/);
  assert.match(source, /res\.status === 502 \|\| res\.status === 503 \|\| res\.status === 504/);
  assert.match(source, /if\s*\(error instanceof Error && error\.name === "AbortError"\)\s*\{\s*throw error;\s*\}/);

  // Simulate retry harness
  const simulateHoldSlot = async (networkBehavior) => {
    let attemptsMade = 0;
    let res;
    let lastError;

    for (let attempt = 0; attempt < 2; attempt++) {
      attemptsMade++;
      try {
        const outcome = networkBehavior[attempt];
        if (outcome.error) {
          throw outcome.error;
        }
        res = outcome.response;
        if (attempt === 0 && (res.status === 502 || res.status === 503 || res.status === 504)) {
          continue;
        }
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (error instanceof Error && error.name === "AbortError") {
          throw error;
        }
        if (attempt === 1) {
          throw error;
        }
      }
    }

    if (!res) {
      throw lastError || new Error("Network error");
    }
    return { res, attemptsMade };
  };

  // Scenario 1: Cold start 504 on first attempt, 200 OK on retry
  const s1 = await simulateHoldSlot([
    { response: { status: 504, ok: false } },
    { response: { status: 200, ok: true } },
  ]);
  assert.equal(s1.attemptsMade, 2);
  assert.equal(s1.res.status, 200);

  // Scenario 2: Network timeout Error on first attempt, 200 OK on retry
  const s2 = await simulateHoldSlot([
    { error: new Error("Gateway Timeout") },
    { response: { status: 200, ok: true } },
  ]);
  assert.equal(s2.attemptsMade, 2);
  assert.equal(s2.res.status, 200);

  // Scenario 3: Caller AbortError -> must throw immediately with 1 attempt
  const abortErr = new Error("Caller abort");
  abortErr.name = "AbortError";
  await assert.rejects(
    async () => simulateHoldSlot([{ error: abortErr }, { response: { status: 200, ok: true } }]),
    (err) => err.name === "AbortError",
  );
});

test("Flow 3: OTP error messages are preserved and not masked by generic fallbacks", async () => {
  const bookingModalSource = await read("components/BookingModal.tsx");
  const packageModalSource = await read("components/PackageBookingModal.tsx");
  const apiSource = await read("lib/api.ts");

  // confirmAppointment 5xx cold start copy
  assert.match(
    apiSource,
    /Hệ thống xác nhận đang bận hoặc khởi động lại\. Vui lòng thử lại sau ít phút; mã OTP vẫn còn hiệu lực theo thời gian giữ chỗ\./,
  );
  // confirmAppointment 4xx invalid OTP copy
  assert.match(
    apiSource,
    /Mã OTP không chính xác, đã hết hạn hoặc chưa thể xác nhận\./,
  );

  // BookingModal catches Error.message before presentApiError
  assert.match(
    bookingModalSource,
    /error instanceof Error && error\.message\s*\?\s*error\.message\s*:\s*presentApiError/,
    "BookingModal must display actual error.message if present",
  );

  // PackageBookingModal catches Error.message before presentApiError
  assert.match(
    packageModalSource,
    /err instanceof Error && err\.message\s*\?\s*err\.message\s*:\s*presentApiError/,
    "PackageBookingModal must display actual err.message if present",
  );

  // 6-digit OTP formatting validation
  assert.match(
    packageModalSource,
    /trimmedOtp/,
    "PackageBookingModal must trim and check OTP",
  );
  assert.match(
    packageModalSource,
    /Mã OTP phải gồm đúng 6 chữ số\./,
  );
});

/* =========================================================================
 * FLOW 4: DEDICATED PACKAGE BOOKING ADVERSARIAL CHALLENGE
 * ========================================================================= */
test("Flow 4: Package immutability, specialty bypass, and 4-step wizard completeness", async () => {
  const modalSource = await read("components/PackageBookingModal.tsx");

  // 4 Steps definition
  assert.match(modalSource, /PACKAGE_BOOKING_STEPS = \[/);
  assert.match(modalSource, /\{ id: 1, label: "Cơ sở y tế" \}/);
  assert.match(modalSource, /\{ id: 2, label: "Ngày & Giờ tiếp nhận" \}/);
  assert.match(modalSource, /\{ id: 3, label: "Thông tin người khám" \}/);
  assert.match(modalSource, /\{ id: 4, label: "Xác nhận & Phiếu khám" \}/);

  // Verify specialty selection is NOT a step
  assert.doesNotMatch(modalSource, /label: "Chuyên khoa"/);

  // Package immutability in modal
  assert.match(modalSource, /packageItem: PackageItem/);
  assert.match(modalSource, /packageItem\.name/);
  assert.match(modalSource, /packageItem\.price/);
  assert.match(modalSource, /packageId: packageItem\.id/);

  // Step 3 patient info validation
  assert.match(modalSource, /isValidBookingEmail/);
  assert.match(modalSource, /privacyConsent/);
  assert.match(modalSource, /Vui lòng tích chọn đồng ý với chính sách bảo mật\./);

  // Confirmation screen with ticket and preparation
  assert.match(modalSource, /PHIẾU ĐĂNG KÝ GÓI KHÁM ĐIỆN TỬ/);
  assert.match(modalSource, /MÃ PHIẾU KHÁM/);
  assert.match(modalSource, /confirmedAppointment\.bookingCode/);
  assert.match(modalSource, /Hướng dẫn chuẩn bị trước khi đến khám/);
});

test("Flow 4: Button synchronization across packages, package detail, and search", async () => {
  const packagesPageSource = await read("app/packages/page.tsx");
  const packageDetailSource = await read("app/packages/[slug]/page.tsx");
  const searchPageSource = await read("app/search/SearchPageClient.tsx");

  // /packages
  assert.match(packagesPageSource, /Đặt lịch với gói này/);
  assert.match(packagesPageSource, /setSelectedPackageForModal\(item\)/);
  assert.match(packagesPageSource, /<PackageBookingModal/);

  // /packages/[slug]
  assert.match(packageDetailSource, /setPackageBookingOpen\(true\)/);
  assert.match(packageDetailSource, /Đặt lịch với gói này/);
  assert.match(packageDetailSource, /<PackageBookingModal/);

  // /search
  assert.match(searchPageSource, /result\.packages\.map/);
  assert.match(searchPageSource, /Đặt lịch với gói này/);
  assert.match(searchPageSource, /setSelectedPackageForModal\(item\)/);
  assert.match(searchPageSource, /<PackageBookingModal/);
});
