#!/usr/bin/env node
/**
 * Seed rich demo content for the local HealthCare Compose stack.
 *
 * Everything goes through the REAL frontend BFF (http://localhost:3000/api/v1)
 * so RBAC, validation and audit boundaries are exercised exactly like a human
 * user, except doctor user accounts which follow the project's SQL fixture
 * convention (see V58/V67 migrations).
 *
 * Usage:
 *   node scripts/seed-rich-content.mjs            # run every pending phase
 *   node scripts/seed-rich-content.mjs --only articles,cms
 *   node scripts/seed-rich-content.mjs --only articles,clinical-review
 *                                                 # clinical-review pushes every
 *                                                 # active DISEASE_GUIDE article
 *                                                 # through ADMIN submission and
 *                                                 # doctor APPROVE so it becomes
 *                                                 # publicly visible
 *   node scripts/seed-rich-content.mjs --list
 *
 * Requires: Compose stack up (frontend :3000, backend :8080, mailpit :8025).
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import zlib from "node:zlib";

const BFF = "http://localhost:3000";
const API = `${BFF}/api/v1`;
const MAILPIT = "http://localhost:8025";
const ORIGIN = "http://localhost:3000";
const PWD = "HealthCare@2026";
const TZ_OFFSET = "+07:00";

const results = [];
const warn = (msg) => console.log(`  ⚠ ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);

function record(phase, action, detail, status) {
  results.push({ phase, action, detail, status });
  const icon = status === "SKIP" ? "◌" : status === "FAIL" ? "✗" : "✓";
  console.log(`  ${icon} [${phase}] ${action}${detail ? ` — ${detail}` : ""}`);
}

// ── HTTP session (cookie jar per persona) ───────────────────────────────────

class Session {
  constructor(email) {
    this.email = email;
    this.cookies = new Map();
  }
  absorb(res) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  csrf() {
    return this.cookies.get("hc_csrf") ?? this.cookies.get("csrf") ?? "";
  }
}

async function rawRequest(method, url, { session, body, form, headers = {} } = {}) {
  const h = { Origin: ORIGIN, ...headers };
  if (session) {
    if (session.cookieHeader()) h.Cookie = session.cookieHeader();
    if (!["GET", "HEAD"].includes(method) && session.csrf()) h["X-CSRF-Token"] = session.csrf();
  }
  if (body !== undefined && !form) h["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers: h,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    redirect: "manual",
  });
  if (session) session.absorb(res);
  return res;
}

async function api(method, path, session, body, form) {
  // Consultation messages and care-plan mutations require an Idempotency-Key;
  // mint one automatically for those POSTs so reruns stay compatible.
  const needsIdem = method === "POST"
    && /\/(consultations\/[^/]+\/messages|care-plans|care-plans\/items\/[^/]+\/(complete|cancel))$/.test(path);
  const res = await rawRequest(method, `${API}${path}`, { session, body, form,
    headers: needsIdem ? { "Idempotency-Key": randomUUID() } : {} });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const code = data && typeof data === "object" ? data.code ?? data.message : text.slice(0, 160);
    const err = new Error(`${method} ${path} → ${res.status}: ${typeof code === "string" ? code : JSON.stringify(code)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const get = (p, s) => api("GET", p, s);
const post = (p, s, b, form) => api("POST", p, s, b, form);
const put = (p, s, b) => api("PUT", p, s, b);

async function login(email) {
  const s = new Session(email);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await post("/auth/browser-sessions", s, { grantType: "PASSWORD", email, password: PWD });
      return s;
    } catch (e) {
      if (e.status === 429 && attempt < 5) {
        const waitMs = attempt * 20000;
        console.log(`  … rate-limited for ${email}, waiting ${waitMs / 1000}s`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw e;
    }
  }
  throw new Error(`login failed after retries: ${email}`);
}

// ── Mailpit OTP extraction ──────────────────────────────────────────────────

async function mailpitOtp(email, { notBefore = 0, attempt = 1 } = {}) {
  for (let i = 0; i < 15; i += 1) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`);
    if (res.ok) {
      const { messages = [] } = await res.json();
      const eligible = [...messages]
        .map((m) => [m, new Date(m.Created ?? 0).getTime()])
        .filter(([, ts]) => ts >= notBefore)
        .sort((a, b) => b[1] - a[1]);
      if (eligible.length > 0) {
        const detail = await (await fetch(`${MAILPIT}/api/v1/message/${eligible[0][0].ID}`)).json();
        const text = `${detail.Text ?? ""} ${detail.HTML ?? ""}`;
        const m = text.match(/\b(\d{6})\b/);
        if (m) return m[1];
      }
    }
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  throw new Error(`No OTP email newer than cutoff found for ${email}`);
}

// ── SQL fixture helper (doctor user accounts, project convention) ───────────

function runSql(sql) {
  execFileSync("docker", ["exec", "infrastructure-postgres-1", "psql", "-U", "healthcare",
    "-d", "healthcare", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: ["ignore", "pipe", "pipe"] });
}
function sqlScalar(sql) {
  const out = execFileSync("docker", ["exec", "infrastructure-postgres-1", "psql",
    "-U", "healthcare", "-d", "healthcare", "-t", "-A", "-c", sql],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return out.trim();
}

// ── Static helpers ──────────────────────────────────────────────────────────

function nextWeekday(from, dayOfWeek) {
  const d = new Date(from);
  const diff = (dayOfWeek - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function exists(listPath, matchFn, session) {
  try {
    const items = await get(listPath, session);
    const arr = Array.isArray(items) ? items : items.content ?? items.items ?? [];
    return arr.find(matchFn) ?? null;
  } catch { return null; }
}

const DOCTOR_AVATARS = [
  "/media/doctors/doctor-7.jpg",
  "/media/doctors/doctor-8.jpg",
  "/media/doctors/doctor-9.jpg",
  "/media/doctors/doctor-10.jpg",
  "/media/doctors/doctor-11.jpg",
];
const ARTICLE_COVERS = ["/media/articles/cham-soc-suc-khoe-tong-quat.jpg",
  "/media/articles/dau-hieu-tim-mach.jpg", "/media/articles/dinh-duong-tang-huyet-ap.jpg",
  "/media/articles/phong-ngua-dot-quy.jpg", "/media/articles/tam-soat-tieu-duong.jpg",
  "/media/articles/thoai-hoa-cot-song.jpg", "/media/articles/tre-bieng-an.jpg",
  "/media/articles/5-dau-hieu-tim-mach.jpg"];

// ── PHASE 1: doctor user accounts (SQL fixture convention) ──────────────────

const NEW_DOCTOR_USERS = [
  { email: "dung.trinh@healthcare.local", name: "BS.CKII Trịnh Anh Dũng" },
  { email: "trang.le@healthcare.local", name: "TS.BS Lê Thu Trang" },
  { email: "viet.phan@healthcare.local", name: "BS.CKI Phan Quốc Việt" },
];

async function phaseDoctorUsers(admin) {
  const hash = sqlScalar("select password_hash from users where email='doctor@healthcare.com'");
  for (const u of NEW_DOCTOR_USERS) {
    const current = sqlScalar(`select count(*) from users where email='${u.email}'`);
    if (current === "0") {
      runSql(`INSERT INTO users (id, email, password_hash, display_name, status, email_verified)
        VALUES (gen_random_uuid(), '${u.email}', '${hash}', '${u.name}', 'ACTIVE', true)
        ON CONFLICT (email) DO NOTHING;`);
      runSql(`INSERT INTO user_roles (user_id, role_id)
        SELECT id, '00000000-0000-0000-0000-000000000002' FROM users WHERE email='${u.email}'
        AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=(SELECT id FROM users WHERE email='${u.email}'));`);
      record("doctor-users", "create", u.email, "OK");
    } else {
      record("doctor-users", "exists", u.email, "SKIP");
    }
  }
}

// ── PHASE 2: hospital catalog (branches, services, packages, faqs) ──────────

const BRANCHES = [
  { name: "Bệnh viện Đa khoa HealthCare — Cơ sở 2, Quận 7", slug: "co-so-2-quan-7",
    address: "105 Nguyễn Văn Linh, Phú Mỹ Hưng, Quận 7, TP. Hồ Chí Minh", phone: "028 5411 2345" },
  { name: "Bệnh viện Đa khoa HealthCare — Hà Nội", slug: "co-so-ha-noi",
    address: "88 Nguyễn Chánh, Cầu Giấy, Hà Nội", phone: "024 7300 5678" },
  { name: "Phòng khám ngoại trú HealthCare — Thủ Đức", slug: "phong-kham-thu-duc",
    address: "214 Võ Văn Ngân, Bình Thọ, Thủ Đức, TP. Hồ Chí Minh", phone: "028 3722 8899" },
];

const SERVICES = [
  { name: "Nội soi dạ dày — đại tràng không đau", slug: "noi-soi-da-day-dai-trang",
    description: "Nội soi tiêu hóa trên và dưới bằng thiết bịIDEO điểm ấy Olympus EVIS X1, gây mê nhẹ theo phác đồ an toàn, bác sĩ tiêu hóa trực tiếp thực hiện và trả kết quả trong ngày." },
  { name: "Siêu âm thai 4D chi tiết", slug: "sieu-am-thai-4d",
    description: "Siêu âm dị tật thai 4D các mốc 12, 22 và 32 tuần với máy Voluson E10, kết hợp đo độ mờ da gáy và sàng lọc sinh hóa." },
  { name: "Xét nghiệm máu toàn diện 42 chỉ số", slug: "xet-nghiem-mau-toan-dien",
    description: "Tầm soát công thức máu, đường huyết, mỡ máu, men gan, chức năng thận, thyroid và dấu hiệu viêm — nhịn ăn 8 tiếng, trả kết quả sau 4 giờ." },
  { name: "Chụp cộng hưởng từ MRI 1.5 Tesla", slug: "chup-mri-1-5-tesla",
    description: "Chụp MRI không cản tranh quay, giảm 40% thời gian quét so với máy thế hệ cũ, hỗ trợ chẩn đoán não, cột sống, khớp và ổ bụng." },
  { name: "Tư vấn dinh dưỡng cá nhân hóa", slug: "tu-van-dinh-duong-ca-nhan-hoa",
    description: "Phân tích thành phần cơ thể InBody 770, xây dựng thực đơn theo bệnh nền (tiểu đường, mỡ máu, gan nhiễm mỡ) và theo dõi 8 tuần." },
  { name: "Khám sức khỏe doanh nghiệp trọn gói", slug: "kham-suc-khoe-doanh-nghiep",
    description: "Gói khám định kỳ cho doanh nghiệp từ 20 người, hóa đơn đỏ, lưu hồ sơ sức khỏe trực tuyến và báo cáo tổng hợp theo năm." },
];

const PACKAGES = [
  { name: "Gói khám tổng quát cơ bản", slug: "goi-tong-quat-co-ban", price: "850000",
    description: "Dành cho người dưới 40 tuổi chưa có bệnh nền: 22 hạng mục khám lâm sàng, xét nghiệm máu cơ bản, siêu âm ổ bụng, X-quang ngực và tư vấn bác sĩ nội tổng hợp." },
  { name: "Gói khám tổng quát nâng cao", slug: "goi-tong-quat-nang-cao", price: "1950000",
    description: "42 hạng mục đầy đủ, bổ sung tầm soát ung thư (CEA, AFP, CA-125), CT scanner phổi liều thấp, siêu âm tuyến giáp và tư vấn dinh dưỡng riêng." },
  { name: "Gói tầm soát tim mạch chuyên sâu", slug: "goi-tam-soat-tim-mach", price: "2400000",
    description: "Dành cho người có tiền sử gia đình tim mạch hoặc trên 45 tuổi: ECG gắng sức, siêu âm tim Doppler, Holter nhịp 24 giờ và đo mỡ máu siêu âm." },
  { name: "Gói tầm soát tiểu đường và biến chứng", slug: "goi-tieu-duong", price: "1490000",
    description: "HbA1c, đường huyết đói và sau ăn, đo vi mạch眼底 đáy mắt, siêu âm thận, đoxAB thần kinh ngoại biên — kèm 2 buổi tư vấn dinh dưỡng." },
  { name: "Gói chăm sóc phụ khoa toàn diện", slug: "goi-phu-khoa-toan-dien", price: "1290000",
    description: "Khám phụ khoa, siêu âm tử cung buồng trừ, tầm soát cổ tử cung HPV và PAP, tầm soát ung thư vú bằng siêu âm vú hai bên." },
  { name: "Gói khám nhi toàn diện cho bé", slug: "goi-kham-nhi", price: "990000",
    description: "Đánh giá tăng trưởng theo WHO, xét nghiệm thiếu máu, tầm soát loạn thị và tai mũi họng, tư vấn dinh dưỡng và tiêm chủng theo lứa tuổi." },
  { name: "Gói sức khỏe người cao tuổi", slug: "goi-nguoi-cao-tuoi", price: "2150000",
    description: "Dành cho 60 tuổi trở lên: đo loãng xương, tầm soát sa sút trí tuệ MMSE, siêu âm động mạch cảnh, xét nghiệm khớp và đánh giá nguy cơ té ngã." },
  { name: "Gói tiền hôn nhân", slug: "goi-tien-hon-nhan", price: "1190000",
    description: "Tầm soát gen tan máu, Rubella, HIV, viêm gan B và C cho cả hai vợ, tư vấn di truyền và chuẩn bị mang thai an toàn." },
];

const FAQS = [
  { q: "Bệnh viện có nhận đặt lịch khám trực tuyến không?", a: "Có. Bạn đặt lịch trực tuyến 24/7 tại mục Đặt khám, chọn bác sĩ, khung giờ và chi nhánh. Sau khi xác nhận OTP qua email, lịch hẹn có hiệu lực và bạn nhận được nhắc lịch trước 24 giờ.", c: "Đặt lịch khám", s: "" },
  { q: "Tôi có thể đổi lịch hẹn bao nhiêu lần và trước bao lâu?", a: "Bạn có thể dời lịch miễn phí tối đa 2 lần, chậm nhất 4 giờ trước giờ hẹn, ngay trong cổng bệnh nhân (mục Lịch hẹn của tôi).", c: "Đặt lịch khám", s: "" },
  { q: "Thanh toán viện phí qua chuyển khoản hoạt động thế nào?", a: "Sau khi khám, bạn nhận mã giao dịch và số tài khoản bệnh viện. Khi ngân hàng xác nhận, hệ thống đối soát tự động trong 15 phút và cập nhật trạng thái đã thanh toán kèm biên lai điện tử.", c: "Thanh toán", s: "" },
  { q: "Hồ sơ bệnh án điện tử có an toàn không?", a: "Hồ sơ được mã hóa và chỉ bác sĩ điều trị trực tiếp được xem. Mọi lần truy cập đều ghi vết kiểm toán; bạn có thể xem lịch sử truy cập trong mục Hồ sơ sức khỏe.", c: "Bảo mật", s: "" },
  { q: "Chatbot AI có thay thế bác sĩ được không?", a: "Không. Chatbot chỉ hỗ trợ phân tích triệu chứng sơ bộ và định hướng chuyên khoa phù hợp. Mọi kết luận chẩn đoán đều thuộc về bác sĩ sau khi khám lâm sàng.", c: "Trợ lý AI", s: "" },
  { q: "Câu hỏi sức khỏe gửi online có được bác sĩ trả lời miễn phí?", a: "Có. Mỗi tuần các bác sĩ chọn lọc câu hỏi tiêu biểu trả lời công khai (ẩn danh theo biệt danh bạn chọn). Thời gian phản hồi trung bình 24–48 giờ.", c: "Hỏi đáp sức khỏe", s: "" },
  { q: "Bảo hiểm y tế có áp dụng khi đặt lịch online?", a: "Bạn khai báo có BHYT khi đặt lịch và xuất trình thẻ tại quầy. Các dịch vụ thuộc phạm vi hưởng sẽ được điều trần theo quy định hiện hành.", c: "Bảo hiểm", s: "" },
  { q: "Tôi quên mật khẩu, khôi phục thế nào?", a: "Chọn Quên mật khẩu tại trang đăng nhập, nhập email và nhập mã OTP gửi đến email của bạn để đặt mật khẩu mới. Mã có hiệu lực 15 phút.", c: "Tài khoản", s: "" },
];

async function phaseCatalog(admin) {
  for (const b of BRANCHES) {
    if (!(await exists("/hospital/branches", (x) => x.slug === b.slug, admin))) {
      try {
        await post("/admin/branches", admin, { ...b, active: true });
        record("catalog", "branch", b.slug, "OK");
      } catch (e) {
        if (e.status === 409) record("catalog", "branch exists (409)", b.slug, "SKIP");
        else record("catalog", "branch", `${b.slug}: ${e.message} ${JSON.stringify(e.data ?? {})}`, "FAIL");
      }
    } else record("catalog", "branch exists", b.slug, "SKIP");
  }
  for (const s of SERVICES) {
    if (!(await exists("/hospital/services", (x) => x.slug === s.slug, admin))) {
      try {
        await post("/admin/services", admin, { ...s, active: true });
        record("catalog", "service", s.slug, "OK");
      } catch (e) {
        if (e.status === 409) record("catalog", "service exists (409)", s.slug, "SKIP");
        else record("catalog", "service", `${s.slug}: ${e.message}`, "FAIL");
      }
    } else record("catalog", "service exists", s.slug, "SKIP");
  }
  for (const p of PACKAGES) {
    if (!(await exists("/hospital/packages", (x) => x.slug === p.slug, admin))) {
      try {
        await post("/admin/packages", admin, { ...p, active: true });
        record("catalog", "package", p.slug, "OK");
      } catch (e) {
        if (e.status === 409) record("catalog", "package exists (409)", p.slug, "SKIP");
        else record("catalog", "package", `${p.slug}: ${e.message}`, "FAIL");
      }
    } else record("catalog", "package exists", p.slug, "SKIP");
  }
  const faqRaw = await get("/hospital/faqs?size=100", admin);
  const faqList = Array.isArray(faqRaw) ? faqRaw : faqRaw.content ?? [];
  for (const f of FAQS) {
    if (!faqList.some((x) => x.question === f.q)) {
      try {
        await post("/admin/faqs", admin, { question: f.q, answer: f.a, category: f.c,
          relatedSpecialtySlug: f.s || undefined, published: true });
        record("catalog", "faq", f.c, "OK");
      } catch (e) {
        if (e.status === 409) record("catalog", "faq exists (409)", f.q.slice(0, 24), "SKIP");
        else record("catalog", "faq", `${f.q.slice(0, 24)}: ${e.message}`, "FAIL");
      }
    } else record("catalog", "faq exists", f.q.slice(0, 24), "SKIP");
  }
}

// ── PHASE 3: doctors + schedules ────────────────────────────────────────────

const NEW_DOCTORS = [
  { fullName: "BS.CKII Trịnh Anh Dũng", slug: "bs-trinh-anh-dung", email: "dung.trinh@healthcare.local",
    specialty: "tim-mach", days: [2, 4, 6],
    bio: "15 năm điều trị tim mạch can thiệp tại Bệnh viện Chợ Rẫy. Chuyên tăng huyết áp, rối loạn nhịp, can thiệp mạch vành qua da. Chứng chỉ can thiệp tim mạch của Hiệp hội Tim mạch châu Á (APSC).",
    achievements: "Top 10 gương mặt y khoa trẻ 2019; 12 công trình đăng tạp chí tim mạch Việt Nam." },
  { fullName: "TS.BS Lê Thu Trang", slug: "tsbs-le-thu-trang", email: "trang.le@healthcare.local",
    specialty: "san-phu-khoa", days: [1, 3, 5],
    bio: "Tiến sĩ sản phụ khoa, 18 năm phụ trách unitsản khoa tại Bệnh viện Từ Dũ. Chuyên chăm sóc thai kỳ nguy cơ cao, hiếm muộn và nội tiết phụ nữ.",
    achievements: "Nghiên cứu sinh tốt nghiệp loại xuất sắc — ĐH Y Dược TP.HCM 2015." },
  { fullName: "BS.CKI Phan Quốc Việt", slug: "bs-phan-quoc-viet", email: "viet.phan@healthcare.local",
    specialty: "tieu-hoa", days: [2, 5, 7],
    bio: "Chuyên khoa cấp II tiêu hóa — gan mật, 12 năm nội soi can thiệp cắt polyp, điều trị viêm gan B và bệnh trào ngược dạ dày thực quản.",
    achievements: "Chứng chỉ nội soi tiêu hóa avanzado WGO 2021." },
  { fullName: "ThS.BS Đặng Mỹ Linh", slug: "thsbs-dang-my-linh", email: null,
    specialty: "nhi-khoa", days: [1, 4, 6],
    bio: "Thạc sĩ nhi khoa, 10 năm điều trị hô hấp — tiêu hóa nhi tại Bệnh viện Nhi Trung ương. Chuyên dinh dưỡng trẻ biếng ăn, hen suyễn trẻ em và theo dõi phát triển toàn diện.",
    achievements: "Giảng viên thực hành nhi khoa — ĐH Y Hà Nội." },
  { fullName: "BS.CKII Hoàng Gia Huy", slug: "bs-hoang-gia-huy", email: null,
    specialty: "than-kinh", days: [3, 5, 7],
    bio: "Chuyên khoa cấp II thần kinh, chuyên đau nửa đầu, động kinh, tai biến mạch máu não và rối loạn giấc ngủ. 14 năm lâm sàng tại Bệnh viện Bạch Mai.",
    achievements: "Học bổng nghiên cứu EEG — ĐH Kyoto 2018." },
];

async function phaseDoctors(admin) {
  const branchesAll = await get("/hospital/branches?size=50", admin);
  const branchList = Array.isArray(branchesAll) ? branchesAll : branchesAll.content ?? [];
  const branchBySlug = new Map(branchList.map((b) => [b.slug, b]));
  const doctorsAll = await get("/hospital/doctors?size=100", admin);
  const doctorList = Array.isArray(doctorsAll) ? doctorsAll : doctorsAll.content ?? [];
  const doctorBySlug = new Map(doctorList.map((d) => [d.slug, d]));
  const userIdCache = new Map();
  for (const d of NEW_DOCTORS) {
    let doctorId = doctorBySlug.get(d.slug)?.id;
    if (doctorId) {
      record("doctors", "exists", d.slug, "SKIP");
    } else {
      try {
        let userId = null;
        if (d.email) {
          userId = userIdCache.get(d.email) ?? sqlScalar(`select id from users where email='${d.email}'`);
          userIdCache.set(d.email, userId);
        }
        const created = await post("/admin/doctors", admin, {
          fullName: d.fullName, slug: d.slug, bio: d.bio,
          photoUrl: DOCTOR_AVATARS[NEW_DOCTORS.indexOf(d) % DOCTOR_AVATARS.length],
          active: true, userId: userId || undefined,
        });
        doctorId = created?.id ?? created?.doctorId;
        record("doctors", "create", d.slug, "OK");
      } catch (e) {
        record("doctors", "create", `${d.slug}: ${e.message}`, "FAIL");
        continue;
      }
    }
    if (!doctorId) {
      warn(`doctor ${d.slug}: no id available`);
      continue;
    }
    // doctors must be assigned to a branch before schedules can be created
    // (doctor_branches has no admin API; seeded via SQL fixture convention)
    const branchIds = branchList.map((b) => b.id).filter(Boolean);
    if (branchIds.length > 0) {
      runSql(`INSERT INTO doctor_branches (id, doctor_id, branch_id)
        SELECT gen_random_uuid(), '${doctorId}', b.id FROM branches b
        WHERE b.id IN (${branchIds.map((id) => `'${id}'`).join(",")})
        AND NOT EXISTS (SELECT 1 FROM doctor_branches db
          WHERE db.doctor_id='${doctorId}' AND db.branch_id=b.id);`);
    }
    for (const day of d.days) {
      for (const [branchSlug, start, end] of [
        ["benh-vien-sai-gon-xanh", "07:30", "11:30"],
        ["co-so-2-quan-7", "13:30", "17:00"],
      ]) {
        const branch = branchBySlug.get(branchSlug);
        if (!branch) { warn(`branch ${branchSlug} missing; skip schedule`); continue; }
        try {
          await post(`/admin/schedules/doctors/${doctorId}/branches/${branch.id}`, admin, {
            dayOfWeek: day, startTime: start, endTime: end,
            slotDurationMinutes: 30, effectiveFrom: "2026-08-01", active: true,
          });
        } catch (e) {
          if (e.status === 409) { /* schedule already exists */ }
          else record("doctors", `schedule d${day}@${branchSlug}`, e.message, "FAIL");
        }
      }
    }
    record("doctors", "schedules", d.slug, "OK");
  }
}

// ── PHASE 4: articles ───────────────────────────────────────────────────────

const ARTICLES = [
  { title: "7 dấu hiệu cảnh báo tim mạch bạn không được chủ quan", category: "Tim mạch", spec: "tim-mach",
    summary: "Đau ngực khi gắng sức, khó thở bất thường, phù chân là những tín hiệu cơ thể gửi đi trước khi biến chứng tim mạch xảy ra. Nhận biết sớm giúp giảm 60% nguy cơ nhồi máu.",
    body: "Bệnh tim mạch là nguyên nhân tử vong hàng đầu tại Việt Nam với khoảng 200.000 ca mỗi năm — tương đương một ca tử vong mỗi 3 phút. Điều đáng nói là phần lớn cơn nhồi máu đầu tiên hoàn toàn có thể được ngăn chặn nếu nhận diện sớm các dấu hiệu cảnh báo.\n\nTim và mạch máu có khả năng bù trừ rất lớn, nên bệnh thường âm thầm tiến triển nhiều năm. Khi triệu chứng rõ ràng xuất hiện, tổn thương đã đi vào giai đoạn nặng. Bài viết dưới đây tổng hợp bảy dấu hiệu quan trọng nhất theo khuyến cáo của Hiệp hội Tim mạch Việt Nam.",
    sections: [
      { heading: "1. Đau ngực khi gắng sức", body: "Cảm giác đè nặng, bóp nghẹt sau xương ức khi leo cầu thang, mang vác vật nặng và giảm khi nghỉ — đây là biểu hiện điển hình của đau thắt ngực ổn định. Cơn đau có thể lan lên vai, hàm hoặc cánh tay trái. Nếu cơn đau xuất hiện cả khi nghỉ ngơi hoặc kéo dài trên 20 phút, hãy đến cấp cứu ngay: đó có thể là dấu hiệu nhồi máu cơ tim cấp." },
      { heading: "2. Khó thở bất thường", body: "Hụt hơi khi làm việc nhẹ mà trước đây bạn làm dễ dàng, phải nằm cao đầu mới ngủ được, hoặc tỉnh giấc giữa đêm vì ngộp thở — dấu hiệu tim bơm yếu, ứ máu phổi. Khó thở kèm theo đau ngực cần được đánh giá trong 24 giờ." },
      { heading: "3. Phù mắt cá chân về chiều", body: "Tim yếu khiến máu ứ lại ở tĩnh mạch, dịch thấm ra mô dưới da, tạo vết lõm khi ấn vào mặt trong mắt cá chân hoặc cẳng chân. Phù một bên chân kèm đau cần loại trừ huyết khối tĩnh mạch sâu." },
      { heading: "4. Tim đập nhanh, loạn nhịp", body: "Hồi hộp đánh trống ngực xuất hiện thường xuyên, tim đập trên 120 nhịp/phút khi nghỉ, hoặc nhịp không đều kéo dài — có thể là rung nhĩ. Rung nhĩ làm tăng 5 lần nguy cơ đột quỵ nếu không được điều chỉnh nhịp và chống đông đúng cách." },
      { heading: "5. Ngủ ngáy kèm ngưng thở", body: "Ngưng thở khi ngủ tắc nghẽn làm huyết áp tăng vọt về đêm, gây dày thất trái và rung nhĩ. Nếu người nhà thấy bạn ngừng thở trên 10 giây nhiều lần mỗi đêm, hãy tầm soát giấc ngủ sớm." },
      { heading: "6. Mệt mỏi kéo dài vô căn", body: "Cảm giác kiệt sức kể cả sau khi ngủ đủ, không muốn làm bất cứ việc gì — tim không bơm đủ máu cho cơ thể. Ở phụ nữ và người cao tuổi, mệt mỏi đôi khi là triệu chứng duy nhất trước nhồi máu." },
      { heading: "7. Choáng váng, ngất khi thay đổi tư thế", body: "Choáng khi đứng dậy đột ngột, nhìn mờ, ù tai có thể do rối loạn nhịp hoặc huyết áp tụt. Một cơn ngất thực sự (mất ý thức hoàn toàn) luôn cần thăm khám tim mạch dù bạn tự tỉnh." },
    ],
    takeaways: ["Đau ngực gắng sức giảm khi nghỉ là tín hiệu đau thắt ngực điển hình", "Phù hai mắt cá chân về chiều thường gặp ở suy tim", "Người trên 40 tuổi nên đo huyết áp và mỡ máu định kỳ 6 tháng/lần"],
    warnings: ["Đau ngực kéo dài trên 20 phút kèm vã mồ hôi → gọi cấp cứu 115", "Ngất kèm tim đập loạn nhịp cần đánh giá trong 24 giờ"],
    prevention: ["Hạn chế muối dưới 5g/ngày", "Đi bộ nhanh 30 phút/ngày, 5 ngày/tuần", "Kiểm soát huyết áp dưới 130/80 mmHg", "Ngừng thuốc lá hoàn toàn sau 1 năm giảm 50% nguy cơ nhồi máu"],
    sources: ["Hiệp hội Tim mạch Việt Nam — Khuyến cáo tăng huyết áp 2023", "WHO Cardiovascular diseases fact sheet 2023"] },

  { title: "Huyết áp cao và thực đơn dinh dưỡng cho người Việt", category: "Dinh dưỡng", spec: "tim-mach",
    summary: "Chế độ ăn giảm muối, tăng rau xanh và đạm thực vật có thể hạ huyết áp tâm thu 8–14 mmHg — hiệu quả tương đương một loại thuốc điều trị tăng huyết áp nền.",
    body: "Tại Việt Nam, cứ 5 người trưởng thành thì có 1 người tăng huyết áp, nhưng chỉ 13% trong số đó kiểm soát được huyết áp tốt. Ngoài thuốc, thay đổi dinh dưỡng là đòn bẩy mạnh nhất mà mọi người bệnh đều có thể thực hiện ngay hôm nay.\n\nNguyên tắc cốt lõi là mô hình DASH (Dietary Approaches to Stop Hypertension) được điều chỉnh phù hợp khẩu phần người Việt: giảm muối nước mắm, tăng rau củ quả tươi, chọn đạm nạc và ngũ cốc nguyên hạt.",
    sections: [
      { heading: "Giảm muối là ưu tiên số một", body: "Người Việt tiêu thụ trung bình 9–10g muối mỗi ngày, gấp đôi khuyến nghị WHO (5g). Muối ẩn nằm chủ yếu ở nước mắm, mắm tôm, dưa muối, thực phẩm chế biến sẵn. Thay 1 thìa nước mắm bằng gia vị thơm (sả, gừng, chanh) đã cắt được 1g muối/bữa." },
      { heading: "Tăng kali tự nhiên", body: "Chuối, khoai lang, rau dền, rau muống, bầu giàu kali giúp thận đào thải natri tốt hơn. Mục tiêu 500g rau xanh và 2–3 quả trái cây mỗi ngày." },
      { heading: "Chọn đạm thông minh", body: "Ưu tiên cá 3 bữa/tuần (cá thu, cá basa, cá diêu hồng), đậu hũ, đậu các loại; hạn chế thịt đỏ dưới 500g/tuần và tránh da, nội tạng động vật." },
      { heading: "Nhật ký huyết áp tại nhà", body: "Đo huyết áp sáng tối sau 5 phút nghỉ, ghi lại và mang đến buổi tái khám. Dữ liệu 7 ngày liên tục giúp bác sĩ điều chỉnh liều thuốc chính xác hơn một lần đo tại phòng khám." },
    ],
    takeaways: ["Mục tiêu muối dưới 5g/ngày kể cả muối ẩn", "DASH điều chỉnh khẩu phần Việt hạ huyết áp 8–14 mmHg", "Kết hợp dinh dưỡng với thuốc, không tự bỏ thuốc khi huyết áp ổn"],
    warnings: ["Đau đầu dữ dội, nhìn mờ kèm huyết áp trên 180/120 → cấp cứu", "Không dùng thực phẩm chức năng thay thế thuốc kê đơn"],
    prevention: ["Duy trì BMI 18,5–22,9", "Hạn chế rượu bia: nam ≤ 2 đơn vị, nữ ≤ 1 đơn vị/ngày", "Uống đủ 1,5–2 lít nước mỗi ngày"],
    sources: ["Bộ Y tế — Hướng dẫn dinh dưỡng hợp lý cho người Việt 2021", "NEJM — DASH-sodium trial"] },

  { title: "Trẻ biếng ăn: khi nào là bình thường, khi nào cần bác sĩ?", category: "Sức khỏe gia đình", spec: "nhi-khoa",
    summary: "80% trường hợp biếng ăn ở trẻ 1–5 tuổi là hành vi học được, không phải bệnh lý. Nhưng 5 dấu hiệu dưới đây cho thấy cần đưa bé đi khám sớm.",
    body: "Bữa cơm trở thành cuộc chiến, mẹ chạy theo đút từng thìa, bé khóc, bà lo... Biếng ăn là lý do khám nhi phổ biến nhất tại các phòng khám dinh dưỡng. Thực tế, phần lớn trẻ biếng ăn hoàn toàn khỏe mạnh — vấn đề nằm ở kỳ vọng và cách cho ăn của người lớn nhiều hơn ở chính bé.\n\nTuy nhiên, biếng ăn cũng có thể là dấu hiệu đầu tiên của thiếu vi chất, nhiễm ký sinh trùng hoặc bệnh lý tiêu hóa. Việc phân biệt hai nhóm này quyết định con có cần can thiệp y tế hay chỉ cần điều chỉnh thói quen.",
    sections: [
      { heading: "Biếng ăn sinh lý theo lứa tuổi", body: "Trẻ 1–3 tuổi tăng trưởng chậm lại so với năm đầu đời nên nhu cầu calo giảm, ăn ít đi là hoàn toàn bình thường. Kén ăn (picky eating) đạt đỉnh ở 2–4 tuổi và tự cải thiện trong đa số trẻ khi môi trường ăn uống thoải mái." },
      { heading: "5 dấu hiệu cần đi khám", body: "1) Không tăng cân hoặc sụt cân 3 tháng liền trên biểu đồ tăng trưởng. 2) Bỏ bú/ăn hoàn toàn ở trẻ dưới 1 tuổi. 3) Nôn trớ kéo dài, tiêu phân lỏng có máu. 4) Bé mệt mỏi, da xanh, hay ốm vặt. 5) Chậm về vận động hoặc ngôn ngữ." },
      { heading: "Nguyên tắc cho ăn không áp lực", body: "Cha mẹ quyết định ăn gì, ăn lúc nào, ăn ở đâu; trẻ quyết định ăn bao nhiêu. Chia 5–6 bữa nhỏ, bày món mới cạnh món bé thích, cấm màn hình trong bữa ăn và luôn cho bé tự cầm muỗng dù rơi vãi." },
      { heading: "Vai trò của vi chất", body: "Thiếu kẽm và thiếu máu do thiếu sắt làm giảm vị giác và cảm giác no. Không tự ý bổ sung — hãy để bác sĩ xét nghiệm và chỉ định đúng đối tượng, đúng liều." },
    ],
    takeaways: ["Theo dõi cân nặng trên biểu đồ WHO quan trọng hơn từng bữa ăn", "Bữa ăn vui vẻ, không đe dọa, không màn hình", "Bổ sung vi chất chỉ khi có chỉ định bác sĩ"],
    warnings: ["Sụt cân kèm nôn kéo dài → khám trong 48 giờ", "Trẻ dưới 6 tháng bỏ bú trên 2 bữa liên tiếp → khám ngay"],
    prevention: ["Bắt đầu ăn dặm đúng thời điểm 6 tháng", "Giữ giờ ăn cố định, cả gia đình ăn cùng trẻ"],
    sources: ["WHO Child Growth Standards", "Viện Dinh dưỡng Quốc gia — Hướng dẫn nuôi dưỡng trẻ nhỏ"] },

  { title: "Phòng ngừa đột quỵ: 8 việc làm ngay hôm nay", category: "Phòng bệnh chủ động", spec: "than-kinh",
    summary: "90% nguy cơ đột quỵ đến từ 10 yếu tố có thể kiểm soát được. Chỉ cần điều chỉnh huyết áp, vận động và ăn uống, bạn đã loại bỏ hơn một nửa nguy cơ.",
    body: "Đột quỵ não hàng năm cướp đi sinh mạng của gần 100.000 người Việt và để lại di chứng liệt nửa người cho hàng chục nghìn người khác. Nhưng tin tốt là nghiên cứu INTERSTROKE trên 27.000 bệnh nhân cho thấy 90% nguy cơ đột quỵ đến từ những yếu tố hoàn toàn có thể phòng tránh.\n\nKhông cần can thiệp y khoa phức tạp — tám thói quen dưới đây, áp dụng đều đặn, giảm nguy cơ đột quỵ của bạn mạnh hơn bất kỳ loại thuốc dự phòng nào.",
    sections: [
      { heading: "1. Kiểm soát huyết áp dưới 130/80", body: "Tăng huyết áp là yếu tố nguy cơ số một, góp phần vào 50% ca đột quỵ. Đo huyết áp định kỳ, uống thuốc đều đặn dù không có triệu chứng, tái khám đúng hẹn." },
      { heading: "2. Rung nhĩ phải chống đông đúng", body: "Nếu được chẩn đoán rung nhĩ, dùng thuốc chống đông theo chỉ dẫn giảm 64% nguy cơ đột quỵ. Bỏ thuốc đột ngột làm tăng nguy cơ gấp đôi trong 30 ngày." },
      { heading: "3. Thuốc lá — ngừng ngay hôm nay", body: "Hút 20 điếu/ngày tăng gấp đôi nguy cơ đột quỵ. Sau 5 năm ngừng thuốc, nguy cơ của bạn xấp xỉ người chưa từng hút." },
      { heading: "4. Đường huyết và mỡ máu", body: "Tiểu đường làm tăng gấp 2 nguy cơ đột quỵ, LDL cholesterol cao làm mạch máu não xơ vữa sớm. Tầm soát 6 tháng/lần nếu có bệnh nền." },
      { heading: "5. Vận động 150 phút mỗi tuần", body: "Đi bộ nhanh, đạp xe hoặc bơi 30 phút/ngày, 5 ngày/tuần giảm 30% nguy cơ đột quỵ so với lối sống thụ động." },
      { heading: "6. Nhận biết FAST — vàng trong cấp cứu", body: "Mặt xệ (Face), tay chân yếu (Arm), nói ngọng (Speech), chớp mắt chớp thời gian (Time). Còn mỗi phút giấc não mất đi 1,9 triệu tế bào thần kinh — gọi 115 ngay lập tức." },
    ],
    takeaways: ["Huyết áp là yếu tố nguy cơ số một — kiểm soát được là phòng được", "Dấu hiệu FAST giúp nhận biết đột quỵ cấp trong 60 giây", "Cửa sổ điều trị vàng: 4,5 giờ đầu từ khi khởi phát"],
    warnings: ["Dấu hiệu FAST xuất hiện → không chờ, không tự uống thuốc, gọi 115", "Đau đầu dữ dội chưa từng gặp kèm nôn → nghi xuất huyết não"],
    prevention: ["Ngủ đủ 7–8 giờ, ngủ quá ít hoặc quá nhiều đều tăng nguy cơ", "Khám sức khỏe tim mạch — thần kinh 1 lần/năm sau 45 tuổi"],
    sources: ["INTERSTROKE study — The Lancet 2010", "Bộ Y tế — Tuần lễ Não quốc gia"] },

  { title: "Thoái hóa cột sống cổ ở dân văn phòng và bài tập 10 phút", category: "Xương khớp", spec: "co-xuong-khop",
    summary: "Cúi đầu 45 độ trước màn hình tạo tải trọng 22kg lên đốt sống cổ. Bốn bài tập đơn giản mỗi ngày giúp giảm 70% đau cổ mạn tính.",
    body: "Đau cổ, tê bì tay, chóng mặt khi quay đầu đã trở thành 'bệnh nghề nghiệp' của hơn 60% người làm việc máy tính trên 4 giờ mỗi ngày. Thoái hóa đốt sống cổ đang trẻ hóa nhanh — phòng khám chúng tôi nhận bệnh nhân 25 tuổi với hình ảnh đĩa đệm chóp như người 50 tuổi.\n\nTin tích cực: hầu hết đau cổ do tư thế đều cải thiện tốt mà không cần phẫu thuật, nếu bạn điều chỉnh công thái học và luyện tập đúng cách.",
    sections: [
      { heading: "Tư thế cúi đầu và tải trọng cổ", body: "Đầu nặng trung bình 5kg. Khi gập 15° tải trọng lên 12kg, 30° là 18kg, 45° là 22kg — như treo một đứa trẻ 8 tuổi lên cổ suốt 8 tiếng làm việc. Màn hình nên ngang tầm mắt, khoảng cách 50–70cm." },
      { heading: "Bốn bài tập giãn cơ cổ", body: "1) Co hàm ngược (chin tuck) 10 lần — kéo cằm về sau tạo 'gấp đôi cằm'. 2) Nghiêng đầu sang trái/phải giữ 20 giây mỗi bên. 3) Xoay vai vòng tròn 10 vòng. 4) Giãn cơ thang: đặt tay phải lên đầu, kéo nhẹ sang phải, giữ 20 giây. Thực hiện 2–3 lần/ngày ngay tại bàn làm việc." },
      { heading: "Khi nào cần chụp MRI", body: "Đau cổ kèm tê bì lan xuống tay, yếu cánh tay, hoặc rối loạn đại tiểu tiện là dấu hiệu chèn ép tủy/thần kinh — cần chụp MRI cột sống cổ và gặp bác sĩ chuyên khoa sớm." },
      { heading: "Gối và tư thế ngủ", body: "Gối cao 8–12cm, giữ cổ thẳng hàng với cột sống. Ngủ sấp là tư thế xấu nhất cho cổ; nằm ngửa hoặc nghiêng với gối kẹp giữa hai đầu gối là lựa chọn tốt." },
    ],
    takeaways: ["Điều chỉnh màn hình ngang mắt quan trọng hơn mọi bài tập", "Chin tuck là bài tập vàng cho cổ thõng về trước", "Tê bì lan xuống tay là dấu hiệu cần MRI sớm"],
    warnings: ["Yếu tay tiến triển nhanh, rối loạn đại tiểu tiện → phẫu thuật cấp cứu", "Đau cổ sau chấn thương xe máy → bất động cổ và đi khám ngay"],
    prevention: ["Nghỉ giải lao 5 phút mỗi giờ làm việc", "Tập bơi ngửa hoặc yoga 2 buổi/tuần"],
    sources: ["Hansraj KK — Surgical Technology International 2014 (tải trọng cột sống cổ)", "Khuyến cáo ĐTCN Hoa Kỳ về đau cổ không đặc hiệu 2020"] },

  { title: "Tiền tiểu đường: cửa sổ vàng để quay lại bình thường", category: "Phòng bệnh chủ động", spec: "noi-tong-hop",
    summary: "Hơn 5 triệu người Việt đang ở giai đoạn tiền tiểu đường mà không hề hay biết. Giảm 7% cân nặng và vận động 150 phút/tuần giúp 58% người bệnh tránh tiểu đường suốt đời.",
    body: "HbA1c từ 5,7–6,4% hoặc đường huyết đói 100–125 mg/dL — bạn rơi vào vùng xám giữa bình thường và tiểu đường. Tin tốt: đây là giai đoạn duy nhất mà bệnh có thể đảo ngược hoàn toàn mà không cần thuốc.\n\nNghiên cứu landmark Diabetes Prevention Program (DPP) theo dõi 3.200 người trong 15 năm chứng minh: thay đổi lối sống tác động vượt trội cả metformin trong việc ngăn tiến triển thành tiểu đường type 2.",
    sections: [
      { heading: "Ai cần tầm soát?", body: "Trên 35 tuổi và thừa cân; có người thân mức độ một mắc tiểu đường; phụ nữ từng đái tháo đường thai kỳ; huyết áp cao hoặc mỡ máu; dấu hiệu đề kháng insulin (da sạm quanh cổ, nách). Tầm soát bằng HbA1c hoặc nghiệm pháp dung nạp đường." },
      { heading: "Chỉ số mục tiêu DPP", body: "Giảm 7% cân nặng ban đầu (70kg → giảm 5kg) và vận động trung bình 150 phút/tuần. Nhóm đạt mục tiêu giảm 58% nguy cơ tiến triển sau 3 năm và duy trì hiệu quả suốt 15 năm theo dõi." },
      { heading: "Ăn gì để hạ đường huyết", body: "Thay 1/2 chén cơm bằng rau xanh hoặc khoai lang; ăn rau và đạm trước tinh bột trong cùng bữa ăn (trình tự này giảm đỉnh đường huyết 30%); uống nước lọc thay nước ngọt — một lon nước ngọt/ngày tăng 26% nguy cơ tiểu đường." },
      { heading: "Giấc ngủ và căng thẳng", body: "Ngủ dưới 6 giờ mỗi đêm làm đề kháng insulin tăng 30% chỉ sau một tuần. Thiền, hít thở sâu 4-7-8 trước ngủ giúp cải thiện cả đường huyết lẫn huyết áp." },
    ],
    takeaways: ["Tiền tiểu đường hoàn toàn đảo ngược được bằng lối sống", "HbA1c 5,7–6,4% là ngưỡng cảnh báo cần hành động", "Tầm soát định kỳ 6–12 tháng nếu có yếu tố nguy cơ"],
    warnings: ["Khát nước cực độ, tiểu đêm nhiều, sụt cân nhanh → khám ngay", "Vết thương lâu liền, tê bì chân ở người tiền tiểu đường cần đánh giá sớm"],
    prevention: ["Ăn rau — đạm trước tinh bột", "Đi bộ 15 phút sau mỗi bữa chính", "Tầm soát HbA1c hằng năm nếu trên 35 tuổi"],
    sources: ["ADA — Standards of Care in Diabetes 2024", "DPP Research Group — NEJM 2002"] },

  { title: "Nội soi dạ dày: chuẩn bị đúng để kết quả chính xác", category: "Tiêu hóa", spec: "tieu-hoa",
    summary: "Nhịn ăn đúng 6 tiếng, ngừng thuốc sắt và thuốc làm sạch dạ dày trước nội soi giúp bác sĩ quan sát trọn vẹn niêm mạc và phát hiện tổn thương nhỏ 2mm.",
    body: "Nội soi tiêu hóa trên là 'tiêu chuẩn vàng' chẩn đoán viêm loét dạ dày, trào ngược, polyp và phát hiện sớm ung thư dạ dày. Nhưng một nội soi có giá trị hay không phụ thuộc rất lớn vào khâu chuẩn bị của người bệnh — niêm mạc còn thức ăn bám sẽ che khuất tổn thương, buộc phải soi lại.\n\nQuy trình tại HealthCare sử dụng nội soi phóng đại NBI kèm gây mê nhẹ theo phác đồ an toàn: bạn ngủ 10–15 phút, tỉnh táo hoàn toàn sau 30 phút và có kết quả hình ảnh ngay.",
    sections: [
      { heading: "Lịch chuẩn bị 48 giờ", body: "Hai ngày trước: tránh thực phẩm có hạt (dưa hấu, ổi, ngô), rau sống, đồ nhiều màu (cải bó xôi làm niêm mạc xanh). Sáu tiếng trước: nhịn hoàn toàn thức ăn và nước. Hai tiếng trước: không đánh răng nuốt nước, không kẹo cao su." },
      { heading: "Thuốc cần báo bác sĩ", body: "Thuốc sắt (nham nhém niêm mạc đen), thuốc chống đông (cần hướng dẫn ngừng đúng giao), thuốc tiểu đường buổi sáng (giãn dạ dày). Không tự ngừng thuốc huyết áp — uống sớm 6 tiếng với ngụm nước nhỏ." },
      { heading: "Quy trình trong phòng soi", body: "Gây mê nhẹ propofol theo dõi sát huyết áp, nhịp thở. Thời gian soi 8–15 phút. Nếu phát hiện polyp, bác sĩ cắt ngay trong cùng lần soi và gửi giải phẫu bệnh." },
      { heading: "Sau nội soi", body: "Sau 30 phút tỉnh táo hoàn toàn, uống nước nguội, ăn cháo loãng. Kiêng thức ăn cay nóng, rượu bia 48 giờ. Có người nhà đưa về trong ngày đầu do còn ảnh hưởng thuốc mê nhẹ." },
    ],
    takeaways: ["Nhịn ăn 6 tiếng là yêu cầu bắt buộc để soi chính xác", "Người trên 40 tuổi nên nội soi dạ dày 1–2 lần/năm nếu có viêm loét", "Nội soi có thể cắt polyp lấy giải phẫu bệnh ngay trong lúc soi"],
    warnings: ["Đau bụng dữ dội, nôn máu, đi ngoài đen sau nội soi → quay lại bệnh viện ngay", "Sốt trên 38,5°C trong 24 giờ sau soi cần kiểm tra"],
    prevention: ["Ăn chậm, nhai kỹ, không nằm ngay sau bữa ăn", "Hạn chế rượu, thuốc lá và thuốc giảm đau NSAID không chỉ định"],
    sources: ["ESGE — Recommendations on sedation in endoscopy 2021", "Hiệp hội Nội soi Tiêu hóa Việt Nam"] },

  { title: "Sàng lọc trước sinh: hiểu đúng Double test, Triple test và NIPT", category: "Sản phụ khoa", spec: "san-phu-khoa",
    summary: "Chỉ một giọt máu mẹ mang thai, các xét nghiệm sàng lọc phát hiện 85–99% hội chứng Down. Hiểu đúng từng mốc xét nghiệm giúp mẹ an tâm suốt thai kỳ.",
    body: "Mỗi thai kỳ đều mang một xác suất nhất định của dị tật bẩm sinh — không phụ thuộc mẹ trẻ hay mẹ lớn tuổi. Sàng lọc trước sinh không chẩn đoán, mà xếp thai kỳ vào nhóm nguy cơ thấp hay cao để hướng dẫn bước tiếp theo. Đây là hành trang khoa học giúp mẹ chủ động thay vì lo lắng mù mờ.",
    sections: [
      { heading: "Mốc 11–13 tuần 6 ngày: Double test + đo NT", body: "Xét nghiệm hai chỉ số (free β-hCG, PAPP-A) kết hợp siêu âm đo độ mờ da gáy NT phát hiện 85% hội chứng Down. NT dày hơn 3,5mm là ngưỡng cần tư vấn chọc ối sớm." },
      { heading: "Mốc 15–20 tuần: Triple/Quad test", body: "Ba đến bốn chất chỉ điểm trong máu mẹ sàng lọc thêm dị tật ống thần kinh (spina bifida). Xét nghiệm này đặc biệt quan trọng với mẹ không kịp làm Double test." },
      { heading: "NIPT — sàng lọc ADN không xâm lấn", body: "Phân tích ADN thai tự do trong máu mẹ từ tuần 10, độ chính xác phát hiện hội chứng Down lên tới 99%. NIPT là lựa chọn ưu tiên cho mẹ trên 35 tuổi hoặc Double test nguy cơ cao." },
      { heading: "Nguy cơ cao rồi làm gì?", body: "Kết quả nguy cơ cao không có nghĩa thai nhi bất thường — nó chỉ ra cần chẩn đoán xác định bằng chọc ối (15–20 tuần) hoặc sinh thiết gai nhau (10–13 tuần). Tỷ lệ biến chứng của chọc ối tại cơ sở có chuyên môn dưới 0,5%." },
    ],
    takeaways: ["Sàng lọc xếp nhóm nguy cơ, không thay thế chẩn đoán", "Mẹ trên 35 tuổi hoặc Double test cao nên cân nhắc NIPT", "Đo NT đúng tuần là khâu kỹ thuật quyết định độ chính xác"],
    warnings: ["Chảy máu âm đạo, đau bụng từng cơn khi mang thai → khám sản ngay", "Kết quả NT cao kèm bất thường chỉ số khác cần tư vấn di truyền sớm"],
    prevention: ["Uống acid folic 400mcg/ngày từ trước mang thai 3 tháng", "Khám thai định kỳ theo phác đồ Bộ Y tế 14 lần"],
    sources: ["ACOG — Prenatal Genetic Screening 2020", "Bộ Y tế — Hướng dẫn quản lý thai kỳ 2022"] },

  { title: "Viêm mũi dị ứng mùa giao thừa: kiểm soát không cần thuốc suốt đời", category: "Tai mũi họng", spec: "tai-mui-hong",
    summary: "Rửa mũi nước muối đúng cách giảm 62% triệu chứng viêm mũi dị ứng. Phân biệt rõ với cảm cúm và polyp mũi giúp điều trị đúng hướng ngay từ đầu.",
    body: "Hắt hơi xổ từng tràng sáng sớm, sổ mũi trong, ngứa mũi mắt kèm nghẹt — viêm mũi dị ứng ảnh hưởng đến 40% dân số Việt Nam, nghiêm trọng nhất vào mùa giao mùa và khi thời tiết chuyển lạnh. Nhiều người sống chung với triệu chứng hàng chục năm mà không biết bệnh hoàn toàn kiểm soát được.",
    sections: [
      { heading: "Dị ứng hay cảm cúm?", body: "Viêm mũi dị ứng: triệu chứng kéo dài trên 2 tuần, hắt hơi nhiều lần liên tiếp, ngứa rõ, không sốt. Cảm cúm: khởi phát nhanh, sốt, đau cơ, hồi phục sau 5–7 ngày. Nếu 'cảm' tái đi tái lại quanh năm, hãy nghĩ dị ứng." },
      { heading: "Rửa mũi — nền tảng điều trị", body: "Dùng dung dịch NaCl 0,9% hoặc nước muối đẳng trương tự pha (đã đun sôi để nguội), nghiêng đầu 45°, rửa mũi sáng tối. Nghiên cứu lâm sàng cho thấy rửa mũi đều đặn giảm 62% nhu cầu thuốc kháng histamine." },
      { heading: "Thuốc xịt corticoid — an toàn dài hạn", body: "Xịt steroid mũi (mometasone, fluticasone) là trụ cột điều trị, bắt đầu hiệu quả sau 3–7 ngày và tối ưu ở tuần 2. Khác với xịt co mạch (naphazoline) — không dùng quá 5–7 ngày để tránh viêm mũi do thuốc." },
      { heading: "Khi nào cần kiểm tra dị nguyên?", body: "Triệu chứng không kiểm soát sau 4 tuần điều trị chuẩn, hoặc nghi ngờ dị ứng bụi nhà, lông thú, phấn hoa — test da điểm hoặc xét nghiệm IgE đặc hiệu giúp xác định và cắt giảm tiếp xúc." },
    ],
    takeaways: ["Rửa mũi nước muối mỗi ngày là can thiệp rẻ nhất, hiệu quả nhất", "Xịt co mạch không quá 1 tuần — dễ gây nghẹt mũi 'nghiện'", "Ở trẻ nhỏ, viêm mũi dị ứng không kiểm soát làm nặng thêm hen suyễn"],
    warnings: ["Đau mặt dữ dội kèm sốt, dịch mũi mủ → viêm xoang cấp cần khám", "Giảm khứu giác kéo dài ở một bên mũi → loại trừ polyp, u lành"],
    prevention: ["Giặt ga gối nước 60°C mỗi tuần, dùng chăn chống ve", "Đóng cửa sổ giờ cao điểm phấn hoa, dùng máy lọc HEPA"],
    sources: ["ARIA guideline 2020", "Hiệp hội Tai Mũi Họng Việt Nam"] },

  { title: "Suy giãn tĩnh mạch chân: đứng lâu nhiều giờ và 6 thói quen cứu vãn", category: "Tim mạch", spec: "tim-mach",
    summary: "Nghề đứng lâu tăng 3 lần nguy cơ suy giãn tĩnh mạch. Nâng chân 15 phút mỗi ngày và tất áp lực y khoa là hai biện pháp có bằng chứng mạnh nhất.",
    body: "Đường vân mạch nổi ngoằn ngoèo như dây leo, phù chân về tối, ban đêm co cứng bắp chân — suy giãn tĩnh mạch chi dưới tấn công 30% phụ nữ và 15% nam giới, đặc biệt giáo viên, nhân viên bán hàng, y tá và người làm việc đứng lâu.",
    sections: [
      { heading: "Van tĩnh mạch và cơ bắp chân", body: "Máu chân về tim nhờ hệ thống van một chiều và 'bơm cơ bắp chân'. Đứng bất động làm van chịu áp lực suốt ngày, dần suy yếu — máu trào ngược, ứ đọng, tĩnh mạch giãn dần và không hồi phục." },
      { heading: "Phân độ CEAP và khi nào cần can thiệp", body: "C0–C1: mao mạch网 nổi, không cần điều trị ngoài thay đổi lối sống. C2: tĩnh mạch nổi rõ — cân nhắc tất áp lực. C3–C6: phù, đổi màu da, loét — cần siêu âm Doppler và can thiệp laser/radiofrequency đóng tĩnh mạch hiển trong." },
      { heading: "Tất áp lực — chọn đúng cỡ", body: "Tất cấp áp lực 20–30 mmHg cẳng chân, đo đúng vòng cổ chân và bắp chân. Mang buổi sáng trước khi xuống giường khi chân chưa phù, tháo trước khi ngủ." },
      { heading: "Sáu thói quen hằng ngày", body: "1) Nâng chân cao hơn tim 15 phút sáng tối. 2) Co duỗi cổ chân 20 lần mỗi giờ làm việc. 3) Đi bộ 30 phút/ngày. 4) Tránh ngồi vắt chân. 5) Kiểm soát cân nặng. 6) Ngủ với chân kê gối cao 10cm." },
    ],
    takeaways: ["Bơm cơ bắp chân là 'tim thứ hai' — hãy vận động nó", "Tất áp lực chỉ hiệu quả khi đúng cỡ và mang đúng giờ", "Loét chân không lành ở người giãn tĩnh mạch cần siêu âm Doppler gấp"],
    warnings: ["Đau dữ dội một chân, sưng nhanh, đỏ nóng → nghi huyết khối tĩnh mạch sâu, cấp cứu", "Chảy máu từ tĩnh mạch giãn vỡ → ấn giữ và đến cơ sở y tế"],
    prevention: ["Thay đổi tư thế mỗi 30–45 phút", "Bơi lội và đạp xe tốt cho tĩnh mạch chân"],
    sources: ["SVS/AVF — Clinical Practice Guidelines for Varicose Veins 2023"] },

  { title: "Viêm phế quản cấp ở trẻ: chăm sóc tại nhà đúng cách", category: "Nhi khoa", spec: "nhi-khoa",
    summary: "90% viêm phế quản cấp trẻ em do virus và không cần kháng sinh. Dấu hiệu thở rút, thở nhanh là ranh giới giữa chăm nhà và vào viện.",
    body: "Con ho từng đợt, khạc đờm, đêm ngủ khò khè — mẹ lo lắng có nên dùng kháng sinh không là câu hỏi gặp mỗi ngày tại phòng khám nhi. Thực tế, viêm phế quản cấp chủ yếu do virus và tự khỏi sau 1–2 tuần; nhiệm vụ của cha mẹ là chăm sóc đúng và nhận biết dấu hiệu nặng.",
    sections: [
      { heading: "Vì sao kháng sinh không giúp đỡ?", body: "Kháng sinh chỉ tác động vi khuẩn, hoàn toàn vô dụng với virus. Dùng kháng sinh không chỉ định gây tiêu tán, rối loạn vi sinh đường ruột, dị ứng và kháng kháng sinh — vấn đề nghiêm trọng của y học toàn cầu." },
      { heading: "Chăm sóc tại nhà: sáu điều mẹ cần", body: "1) Uống nhiều nước ấm chia nhỏ. 2) Dùng máy tạo độ ẩm hoặc tắm hơi cho phòng ngủ. 3) Vỗ rung lồng ngực trước ngủ 5 phút. 4) Mũi thông thoáng bằng nước muối trước bú, trước ngủ. 5) Nâng đầu giường 15°. 6) Thuốc hạ sốt paracetamol đúng liều 10–15mg/kg khi sốt trên 38,5°C hoặc bé khó chịu." },
      { heading: "Dấu hiệu vào viện ngay", body: "Thở nhanh (trẻ <2 tháng >60 lần/phút; 2–12 tháng >50; 1–5 tuổi >40), thở rút lồng ngực, khò khè liên tục không đáp ứng, tím quanh môi, bỏ bú trên một nửa lượng bình thường, co giật, li bì." },
      { heading: "Phòng tái phát", body: "Tránh khói thuốc lá tuyệt đối — phơi khói làm tăng 2 lần viêm đường hô hấp tái phát. Tiêm vắc-xin cúm hằng năm từ 6 tháng tuổi và đầy đủ tiêm chủng mở rộng." },
    ],
    takeaways: ["Đếm nhịp thở 1 phút trọn vẹn là chỉ số quan trọng nhất", "Kháng sinh không rút ngắn viêm phế quản do virus", "Khói thuốc lá trong nhà là kẻ thù số một của phổi trẻ"],
    warnings: ["Thở rút kèm tím môi → cấp cứu ngay", "Sốt trên 3 ngày không giảm cần khám loại trừ viêm phổi"],
    prevention: ["Tiêm cúm mùa hằng năm cho bé và người chăm sóc", "Rửa tay trước khi chăm con — 80% virus lây qua tay"],
    sources: ["WHO — Pocket Book of Hospital Care for Children 2nd ed", "AAP — Diagnosis and Management of Bronchiolitis"] },

  { title: "Rối loạn nội tiết nữ: chậm kinh, mụn và rậm lông nói lên điều gì?", category: "Sản phụ khoa", spec: "san-phu-khoa",
    summary: "Hội chứng buồng trứng đa nang gặp ở 1/10 phụ nữ tuổi sinh sản. Chẩn đoán sớm và kiểm soát cân nặng giảm 80% nguy cơ tiểu đường type 2 sau này.",
    body: "Kinh nguyệt thất thường 2–3 tháng mới một lần, mụn quanh cằm mãi không hết, lông mọc dày hơn ở cằm và ngực — nhiều chị em xem đây là chuyện nhỏ. Nhưng bộ ba triệu chứng này là dấu hiệu kinh điển của hội chứng buồng trứng đa nang (PCOS), bệnh nội tiết phổ biến nhất ở phụ nữ tuổi sinh sản.",
    sections: [
      { heading: "Tiêu chuẩn chẩn đoán Rotterdam", body: "Hai trong ba tiêu chí: (1) rối loạn phóng noãn — kinh thưa hoặc vô kinh; (2) bằng chứng thừa androgen lâm sàng hoặc xét nghiệm; (3) siêu âm buồng trứng đa nang (≥12 nang 2–9mm mỗi buồng trứng hoặc thể tích >10ml)." },
      { heading: "PCOS không chỉ là chuyện kinh nguyệt", body: "70% người PCOS có đề kháng insulin — nền tảng của tiểu đường type 2, gan nhiễm mỡ và tăng huyết áp sau này. Kiểm soát cân nặng giảm 5–10% giúp 60% người bệnh rối loạn phóng noãn tự phục hồi mà không cần thuốc kích thích." },
      { heading: "Chế độ ăn cho người PCOS", body: "Ưu tiên carbohydrate chỉ số glycemic thấp (yến mạch, gạo lứt, bánh mì đen), đạm nạc mỗi bữa, omega-3 từ cá béo 2–3 lần/tuần. Hạn chế đồ ngọt và nước trái cây đóng hộp — đường lỏng tăng insulin đột biến mạnh nhất." },
      { heading: "Khi nào cần khám ngay", body: "Kinh nguyệt mất trên 3 tháng (loại trừ mang thai), chu kỳ kéo dài trên 35 ngày kéo trên 1 năm, rậm lông tiến triển nhanh, hoặc dự định mang thai trong 6–12 tháng tới — cần đánh giá nội tiết và siêu âm sớm." },
    ],
    takeaways: ["Kinh thưa + mụn + rậm lông = bộ ba cần đánh giá PCOS", "Giảm 5–10% cân nặng thay đổi prognosis mạnh hơn nhiều loại thuốc", "PCOS là bệnh dài hạn — cần tầm soát tiểu đường và tim mạch định kỳ"],
    warnings: ["Chảy máu âm đạo kéo dài trên 7 ngày hoặc rất nhiều → khám ngay", "Đau bụng dưới dữ dội một bên kèm nôn → loại trừ xoắn buồng trứng"],
    prevention: ["Duy trì BMI dưới 23", "Vận động kháng lực 2 buổi/tuần giúp cải thiện đề kháng insulin"],
    sources: ["Rotterdam ESHRE/ASRM criteria 2003", "International Evidence-based Guideline for PCOS 2023"] },

  { title: "Chăm sóc da mặt cơ bản: 3 bước đủ dùng cho da người Việt", category: "Da liễu", spec: "da-lieu",
    summary: "Làm sạch dịu nhẹ — dưỡng ẩm — chống nắng là trụ cột khoa học của làn da khỏe. Nhiều bước quá hoặc tẩy da hàng ngày là nguyên nhân hàng đầu da nhạy cảm.",
    body: "Kem thủy phân, toner, essence, serum, mặt nạ giấy, kem chống nắng... quy trình 10 bước đang khiến da của nhiều người Việt trẻ yếu đi thay vì đẹp lên. Là da liễu, chúng tôi gặp ngày càng nhiều 'da nhạy cảm do tự gây ra' — hàng rào bảo vệ bị phá vỡ bởi over-exfoliation và stacking quá nhiều hoạt chất.",
    sections: [
      { heading: "Bước 1: Làm sạch dịu nhẹ", body: "Sữa rửa mặt pH 5,0–6,0, không sulfate mạnh. Rửa 2 lần/ngày là đủ; da khô có thể chỉ dùng sữa rửa buổi tối, buổi sáng rửa nước. Da căng rít sau rửa là dấu hiệu lớp lipid bảo vệ bị cuốn trôi." },
      { heading: "Bước 2: Dưỡng ẩm phù hợp loại da", body: "Da dầu: texture gel, thành phần niacinamide, HA. Da khô: kem chứa ceramide, bơ hạt mỡ. Da hỗn hợp: gel cho vùng chữ T, kem cho má. Dưỡng ẩm đầy đủ giúp da tự phục hồi và giảm tiết dầu phản ứng." },
      { heading: "Bước 3: Chống nắng mỗi ngày", body: "SPF 30–50 PA+++, lượng đủ 1/4 muỗng cà phê cho mặt, thoa lại sau 2 giờ phơi nắng thực tế. 80% lão hóa da sớm đến từ tia UV — chống nắng là 'retinol giá rẻ' hiệu quả nhất mọi thời đại." },
      { heading: "Hoạt chất nên thêm từ từ", body: "Mới: niacinamide 5% giúp giảm dầu và vết thâm. Sau 4 tuần ổn định: retinol nồng độ thấp 2 đêm/tuần (chống nắng bắt buộc). Không chồng nhiều hoạt chất mạnh cùng đêm — đặc biệt AHA/BHA với retinol." },
    ],
    takeaways: ["Ba bước làm sạch — ẩm — nắng là nền tảng không thể thay thế", "Da căng rít sau rửa mặt là báo động phá hàng rào bảo vệ", "Chống nắng đều đặn quan trọng hơn serum đắt tiền"],
    warnings: ["Da châm chích, mẩn đỏ kéo dài trên 3 ngày → ngưng mọi hoạt chất, gặp bác sĩ da liễu", "Mụn viêm lan nhanh, đau, để lại sẹo → không tự nặn, khám sớm"],
    prevention: ["Thay vỏ gối 2 lần/tuần", "Không thử nghiệm nhiều sản phẩm mới cùng lúc"],
    sources: ["AAD — Skin care basics", "Dermatology Practical & Conceptual — Skin barrier 2018"] },

  { title: "Khô mắt do màn hình: hội chứng nhìn máy tính và quy tắc 20-20-20", category: "Mắt", spec: "mat",
    summary: "Chúng tôi chớp mắt 66% ít hơn khi nhìn màn hình. Quy tắc 20-20-20 kết hợp nhân tí mắt nghệ thuật giảm 70% triệu chứng khô mắt nghề nghiệp.",
    body: "Buổi chiều mắt cay xè, nhìn mờ thoáng qua, cảm giác có cát trong mắt — hội chứng nhìn máy tính (Computer Vision Syndrome) ảnh hưởng đến 70% người làm việc văn phòng. Khác với khô mắt bệnh lý, chứng này hoàn toàn cải thiện được bằng thói quen và môi trường làm việc đúng.",
    sections: [
      { heading: "Vì sao màn hình làm khô mắt?", body: "Nhìn màn hình tập trung khiến tần suất chớp mắt giảm từ 15–20 lần/phút xuống 5–7 lần/phút, và độ khép mí cũng nông hơn — lớp nước mắt bốc hơi nhanh không được thay mới. Điều hòa, quạt thổi trực tiếp vào mặt làm tình trạng nặng thêm." },
      { heading: "Quy tắc 20-20-20 và nhân tí có chủ đích", body: "Cứ 20 phút nhìn màn hình, nhìn vật cách 20 feet (6m) trong 20 giây. Nhớ chớp mắt thật trọn vẹn 10 lần mỗi lần nghỉ. Đặt nhắc nhở trên máy tính trong 2 tuần đầu để hình thành phản xạ." },
      { heading: "Công thái học màn hình", body: "Màn hình cách mắt 50–70cm, đỉnh màn hình ngang hoặc thấp hơn mắt 5cm (mắt nhìn hơi xuống giúp mí mắt khép kín hơn và giảm vùng lộ giác mạc). Độ sáng màn hình cân bằng với phòng, bật chế độ lọc ánh sáng xanh buổi tối." },
      { heading: "Thuốc nhỏ mắt — chọn thế nào?", body: "Nhỏ mắt nhân tạo không bảo quản (single-use) an toàn dùng dài hạn. Tránh sản phẩm 'trắng mắt dài hạn' chứa vasoconstrictor — dùng quá 3 ngày gây đỏ mắt phản ứng. Nếu khô mắt kèm đau, nhạy cảm ánh sáng, nhìn mờ kéo dài → khám chuyên khoa mắt." },
    ],
    takeaways: ["Chớp mắt đầy đủ là 'chương trình chăm mắt miễn phí' hiệu quả nhất", "Màn hình thấp hơn mắt một chút giúp giảm bốc hơi nước mắt", "Nhỏ mắt trắng dài hạn có vasoconstrictor không dùng quá 3 ngày"],
    warnings: ["Đau mắt dữ dội kèm nhìn mờ, thấy quầng sáng → khám trong 24 giờ", "Đỏ mắt một bên kèm nhức sâu hốc mắt → loại trừ viêm giác mạc, glaucoma cấp"],
    prevention: ["Đặt màn hình dưới mắt 5–10cm", "Uống đủ nước và bổ sung omega-3 giúp ổn định màng nước mắt"],
    sources: ["AOA — Computer Vision Syndrome guideline", "TFOS DEWS II Report 2017"] },

  { title: "Khám sức khỏe định kỳ nên làm gì ở từng độ tuổi?", category: "Phòng bệnh chủ động", spec: "noi-tong-hop",
    summary: "20–30 tuổi kiểm tra nền tảng; 30–40 thêm tầm soát chuyển hóa; 40–60 tầm soát ung thư; trên 60 đánh giá toàn diện. Một trang hướng dẫn cho mọi lứa tuổi.",
    body: "'Tôi khỏe, không đau đâu cả, khám làm gì?' — đây là suy nghĩ khiến nhiều người Việt chỉ đến bệnh viện khi bệnh đã nặng. Trong khi đó, nhiều bệnh nguy hiểm nhất (tăng huyết áp, tiểu đường, ung thư gan, ung thư vú, ung thư đại trực tràng) âm thầm hàng năm trước khi có triệu chứng. Khám định kỳ đúng độ tuổi chính là 'bảo hiểm sức khỏe' rẻ nhất.",
    sections: [
      { heading: "20–30 tuổi: nền tảng", body: "Hằng năm: khám lâm sàng tổng quát, công thức máu, đường huyết, men gan, siêu âm ổ bụng. Phụ nữ: khám phụ khoa + tầm soát cổ tử cung từ 21 tuổi. Bổ sung: xét nghiệm viêm gan B (tiêm vắc-xin nếu âm tính), kiểm tra thị lực." },
      { heading: "30–40 tuổi: chuyển hóa", body: "Thêm mỡ máu đầy đủ 6 tháng–1 năm/lần, đo huyết áp tại nhà, siêu âm gan (gan nhiễm mỡ), phụ nữ trên 35 tuổi bắt đầu siêu âm vú định kỳ. Nam giới có tiền sử gia đình bệnh tim mạch nên làm ECG gắng sức sớm." },
      { heading: "40–60 tuổi: tầm soát ung thư", body: "Nội soi dạ dày 1–2 năm (người Việt có tỷ lệ ung thư dạ dày cao), nội soi đại tràng bắt đầu từ 45 tuổi, chụp CT phổi liều thấp nếu hút thuốc trên 20 gói-năm, đàn ông PSA từ 50 tuổi (45 nếu có yếu tố nguy cơ), phụ nữ chụp nhũ ảnh từ 40–45 tuổi 1–2 năm/lần." },
      { heading: "Trên 60 tuổi: toàn diện và chức năng", body: "Đo loãng xương (phụ nữ sau mãn kinh), đánh giá trí nhớ, kiểm tra thính lực, thị lực, đo động mạch cảnh, tầm soát sa sút trí tuệ và nguy cơ té ngã. Đánh giá đa chuyên khoa 1 lần/năm là khoản đầu tư chất lượng sống đáng nhất." },
    ],
    takeaways: ["Bệnh nặng nhất thường âm thầm — tầm soát là phát hiện sớm duy nhất", "Tầm soát ung thư có 'độ tuổi bắt đầu' riêng — không chờ triệu chứng", "Mang kết quả cũ theo khi khám để bác sĩ so sánh tiến triển"],
    warnings: ["Sụt cân không rõ nguyên nhân trên 5% trong 6 tháng → đánh giá toàn diện ngay", "Thay đổi thói quen đại tiểu tiện kéo trên 2 tuần → nội soi đại tràng sớm"],
    prevention: ["Đặt lịch khám định kỳ vào cùng tháng mỗi năm để không quên", "Chọn gói khám phù hợp độ tuổi và yếu tố nguy cơ cá nhân"],
    sources: ["USPSTF — Preventive Services Recommendations 2024", "Bộ Y tế — Hướng dẫn khám sức khỏe định kỳ"] },

  { title: "Đau dạ dày buổi sáng: 6 nguyên nhân và cách ăn uống hợp lý", category: "Tiêu hóa", spec: "tieu-hoa",
    summary: "Đau vùng thượng vị lúc bụng đói thường liên quan viêm dạ dày, trào ngược hoặc loét tá tràng. Nhận đúng nguyên nhân giúp chọn chế độ ăn phù hợp ngay.",
    body: "Sáng ngủ dậy thấy âm ỉ vùng thượng vị, ăn vào đỡ nhưng đầy hơi — hoặc ngược lại ăn xong đau hơn. Đau dạ dày buổi sáng là lời nhắc cơ thể rằng niêm mạc tiêu hóa đang bị tổn thương hoặc nhịp nhàng tiết acid đã rối loạn. Hiểu đúng cơ chế giúp bạn chọn đúng cách ăn uống thay vì chỉ dựa thuốc giảm đau.",
    sections: [
      { heading: "Sáu nguyên nhân thường gặp", body: "1) Viêm dạ dày do HP (Helicobacter pylori). 2) Loét tá tràng — đau điển hình khi đói, ăn vào đỡ. 3) Trào ngược dạ dày thực quản — đau kèm ợ nóng buổi sáng. 4) Dùng thuốc giảm đau NSAID kéo dài. 5) Stress và thiếu ngủ làm tăng tiết acid. 6) Uống rượu bia, cà phê lúc bụng đói." },
      { heading: "Chế độ ăn bảo vệ dạ dày", body: "Không bỏ bữa sáng — acid tiết đêm cần được trung hòa. Ưu tiên cháo, súp, bánh mì mềm, trứng luộc. Chia 4–5 bữa nhỏ. Hạn chế: cà phê lúc đói (uống sau ăn hoặc thêm sữa), nước ép cam bưởi lúc đói, đồ cay nóng, thức ăn chiên nhiều dầu." },
      { heading: "Khi nào cần nội soi và xét nghiệm HP", body: "Đau kéo dài trên 2 tuần dù đã điều chỉnh ăn uống, nôn ra máu, đi ngoài đen, sụt cân không rõ nguyên nhân, trên 40 tuổi chưa từng nội soi — những trường hợp này nên nội soi tiêu hóa trên và xét nghiệm hơi thở hoặc kháng nguyên phân tìm HP." },
      { heading: "Diệt HP — điều trị hoàn toàn có thể", body: "HP là vi khuẩn gây ung thư dạ dày nhóm 1 theo WHO. Phác đồ diệt trừ 14 ngày với tỷ lệ thành công trên 85% nếu tuân thủ đúng giờ và không bỏ giữa chừng. Kiểm tra diệt trừ sau 4 tuần ngừng thuốc (test hơi thở 13C)." },
    ],
    takeaways: ["Đau khi đói, ăn vào đỡ nghĩ đến loét tá tràng", "Không uống cà phê, nước chanh lúc bụng đói nếu có viêm dạ dày", "Diệt HP đúng phác đồ giảm rõ nguy cơ ung thư dạ dày"],
    warnings: ["Nôn máu hoặc phân đen hắc ín → cấp cứu ngay", "Đau thượng vị đột ngột dữ dội như bị đâm → nghi thủng dạ dày, không ăn uống gì, gọi 115"],
    prevention: ["Ăn đúng giờ, không bỏ bữa sáng", "Hạn chế NSAID tự mua — báo bác sĩ nếu có bệnh dạ dày"],
    sources: ["Maastricht VI — H. pylori consensus report 2022", "Bộ Y tế — Hướng dẫn chẩn đoán và điều trị HP"] },

  { title: "Bài tập kegel và sức khỏe sàn chậu cho phụ nữ sau sinh", category: "Sản phụ khoa", spec: "san-phu-khoa",
    summary: "Sàn chậu yếu gặp ở 1/3 phụ nữ sau sinh, gây tiểu không tự chủ khi hắt hơi, cười. Tập kegel đúng kỹ thuật 3 tháng cải thiện rõ rệt ở 70% trường hợp.",
    body: "Hắt hơi một chút là nước rỉ ra, không dám nhảy dây, không dám cười lớn — tiểu không tự chủ khi gắng sức là chuyện mà 30% phụ nữ sau sinh âm thầm chịu đựng, tưởng rằng 'sinh con ai cũng vậy'. Thực tế, đây là dấu hiệu sàn chậu yếu và hoàn toàn cải thiện được nếu tập đúng cách từ sớm.",
    sections: [
      { heading: "Sàn chậu là gì và vì sao yếu đi?", body: "Sàn chậu là nhóm cơ như cái đai nâng bladder, tử cung và trực tràng. Thai kỳ 9 tháng đè nén, sinh thường qua đường âm đạo căng giãn, sinh mổ lão hóa và béo bụng đều làm cơ này yếu dần. Tiền mãn kinh thiếu estrogen cũng làm sàn chậu thoái hóa." },
      { heading: "Tìm đúng cơ trước khi tập", body: "Cách nhận biết: khi đi tiểu, ngưng dòng nước giữa chừng — cơ vừa dùng chính là sàn chậu (chỉ dùng để nhận biết, không tập khi đang tiểu thường xuyên). Khi tập: tưởng tượng đang nhịn khí hư và nhịn gió cùng lúc, hít vào thả lỏng, thở ra từ từ siết cơ và nâng lên trong 3–5 giây, rồi thả lỏng đủ lâu." },
      { heading: "Chương trình tập 12 tuần", body: "Tuần 1–4: siết 3 giây thả 3 giây × 10 lần × 3 hiệp/ngày, tư thế nằm. Tuần 5–8: siết 5 giây thả 5 giây × 10 × 3, tập khi ngồi. Tuần 9–12: siết 10 giây × 10 × 3, kết hợp tư thế đứng và khi đi lại. Kết quả rõ ở tuần 8–12 nếu kỹ thuật đúng." },
      { heading: "Khi nào cần phục hồi chức năng chuyên sâu", body: "Cảm giác nặng hạ bộ, thấy khối sa âm đạo (sa sinh dục), tiểu không kiểm soát hoàn toàn, hoặc không cảm nhận được cơ sàn chậu sau 6 tuần tự tập — cần đánh giá tại đơn vị phục hồi chức năng sàn chậu có điện cơ và liệu pháp sinh học phản hồi." },
    ],
    takeaways: ["Tập kegel đúng kỹ thuật quan trọng hơn tập nhiều", "Tiểu rỉ khi gắng sức sau sinh không phải 'chuyện thường' — điều chỉnh được", "Bắt đầu tập ngay từ tuần 6 sau sinh (sau khám sản 6 tuần)"],
    warnings: ["Đau dữ dội vùng sinh mổ/езда sinh thường, sốt → khám sản ngay", "Khối sa lộ ra ngoài âm đạo → cần đánh giá sa sinh dục sớm"],
    prevention: ["Kiểm soát cân nặng thai kỳ hợp lý", "Không mang vác nặng trong 3 tháng đầu sau sinh"],
    sources: ["NICE — Urinary incontinence and pelvic organ prolapse 2019", "AAP/ACOG guideline postpartum care 2018"] },

  { title: "Mất ngủ mạn tính: trị liệu nhận thức hành vi hiệu quả hơn thuốc", category: "Thần kinh", spec: "than-kinh",
    summary: "CBT-I là liệu pháp chuẩn vàng cho mất ngủ mạn tính, hiệu quả dài hạn vượt trội thuốc ngủ. Sáu kỹ thuật có thể tự áp dụng ngay từ tối nay.",
    body: "Nằm trên giường 2 tiếng chưa ngủ được, 3 giờ sáng mắt mở trừng trừng nhìn trần nhà, sáng dậy như xe hết xăng... Mất ngủ mạn tính theo dõi 1/3 người trưởng thành đô thị. Nhiều người chạy đến thuốc ngủ trước khi thử liệu pháp hành vi — trong khi hướng dẫn quốc tế đều khuyến nghị CBT-I (trị liệu nhận thức hành vi cho mất ngủ) là lựa chọn đầu tay.",
    sections: [
      { heading: "Vệ sinh giấc ngủ — nền tảng", body: "Giờ ngủ thức dậy cố định kể cả cuối tuần (sai lệch trên 1 giờ làm rối đồng hồ sinh học). Phòng tối hoàn toàn, 24–26°C, yên tĩnh. Không caffeine sau 14 giờ — cafein có chu kỳ bán rã 5–6 giờ. Rượu giúp vào ngủ nhanh nhưng phá vỡ giấc ngủ nửa sau đêm." },
      { heading: "Quy tắc kích thích: giường chỉ để ngủ", body: "Nếu 20 phút chưa ngủ được, rời giường, ra phòng khác làm việc nhẹ nhàng dưới ánh sáng mờ (đọc sách giấy, nghe nhạc êm), chỉ quay lại giường khi buồn ngủ thật sự. Não cần học lại liên kết 'giường = ngủ' thay vì 'giường = lo lắng thức trắng'." },
      { heading: "Hạn chế giấc ngủ ban ngày và bù ngủ", body: "Ngủ trưa dưới 30 phút và trước 15 giờ. Ngủ bù cuối tuần quá nhiều tạo 'jet lag xã hội' — sáng thứ Hai mệt như mới bay từ Mỹ về. Nếu tối trước mất ngủ, sáng hôm sau vẫn dậy đúng giờ; cơ thể sẽ tự ngủ sâu hơn đêm tiếp theo." },
      { heading: "Buồn nôn vì lo lắng về giấc ngủ", body: "Lo 'tối nay chắc lại mất ngủ' chính là động cơ duy trì mất ngủ. Kỹ thuật viết nhật ký lo âu trước ngủ 15 phút: ghi ra điều bận tâm và việc cần làm ngày mai — bộ não được 'giao nhiệm vụ' sẽ ngừng lặp đi lặp lại lúc nằm." },
    ],
    takeaways: ["Dậy đúng giờ mỗi ngày là liều thuốc đồng hồ sinh học mạnh nhất", "20 phút không ngủ được thì rời giường — đừng nằm chờ", "Thuốc ngủ chỉ dùng ngắn hạn dưới 4 tuần, không tự ý tăng liều"],
    warnings: ["Ngáy lớn kèm ngưng thở khi ngủ, ngủ đủ vẫn mệt → tầm soát ngưng thở khi ngủ", "Mất ngủ kèm buồn chán kéo dài, mất hứng thú → đánh giá trầm cảm"],
    prevention: ["Ánh sáng sáng sớm 15–30 phút giúp thiết lập đồng hồ sinh học", "Không mang công việc và điện thoại lên giường"],
    sources: ["AASM/ Sleep Research Society — CBT-I as first-line treatment", "Bộ Y tế — Hướng dẫn chẩn đoán rối loạn giấc ngủ"] },

  { title: "Béo gan không rượu: bệnh của thời đại ăn nhanh, ngồi nhiều", category: "Tiêu hóa", spec: "tieu-hoa",
    summary: "25% người trưởng thành Việt Nam có gan nhiễm mỡ mà không uống rượu bia. Giảm 5–10% cân nặng là cách duy nhất được chứng minh làm hết mỡ gan.",
    body: "Siêu âm ổ bụng định kỳ trả về dòng chữ 'gan tăng âm nhẹ — gan nhiễm mỡ độ 1'. Nhiều người xem nhẹ vì không đau không nhức. Nhưng gan nhiễm mỡ không do rượu (NAFLD) tiến triển âm thầm thành viêm gan mỡ, xơ hóa và trong 15–20% trường hợp là xơ gan. Tin đáng mỡ: giai đoạn mỡ hóa đơn thuần hoàn toàn hồi phục được.",
    sections: [
      { heading: "Ai có nguy cơ cao nhất?", body: "Béo bụng (vòng bụng nam >90cm, nữ >80cm), tiểu đường type 2, mỡ máu, hội chứng chuyển hóa. Nhưng lưu ý: 20% người gan nhiễm mỡ có cân nặng bình thường — 'thin outside, fat inside' thường gặp ở người ít vận động, ăn nhiều đường và tinh bột tinh chế." },
      { heading: "Dinh dưỡng theo bằng chứng", body: "Cắt đường lỏng trước tiên: nước ngọt, trà sữa, nước ép đóng hộp — fructose là 'nguyên liệu' tổng hợp mỡ gan trực tiếp. Thay tinh bột tinh chế bằng ngũ cốc nguyên hạt. Cà phê đen không đường 2–3 ly/ngày (nếu dung nạp tốt) được nhiều nghiên cứu ghi nhận liên quan giảm xơ hóa gan." },
      { heading: "Vận động — liều lượng cụ thể", body: "150 phút cardio trung bình/tuần (đi bộ nhanh, đạp xe) giảm mỡ gan ngay cả khi cân nặng chưa đổi. Thêm kháng lực 2 buổi/tuần tăng nhạy insulin. Mục tiêu giảm 5–10% cân nặng trong 6 tháng — quá nhanh (nhịn ăn cực đoan) ngược lại có thể làm gan nặng thêm." },
      { heading: "Theo dõi và ngưỡng cần điều trị", body: "Xét nghiệm men gan, siêu âm sợi hủy (FibroScan) 6 tháng/lần. Nếu men gan tăng kéo dài hoặc độ xơ hóa từ F2 trở lên, cần đánh giá chuyên khoa gan — hiện có thuốc mới (agonist GLP-1, resmetirom) cho giai đoạn tiến triển theo chỉ định bác sĩ." },
    ],
    takeaways: ["Gan nhiễm mỡ có thể hồi phục hoàn toàn ở giai đoạn sớm", "Cắt nước ngọt và đi bộ đều đặn là hai can thiệp mạnh nhất", "Người gầy vẫn có thể nhiễm mỡ gan — chớ chủ quan theo ngoại hình"],
    warnings: ["Vàng da, bụng chướng, mạch nhện → đánh giá xơ gan ngay", "Men gan AST/ALT tăng trên 3 lần bình thường cần chuyên khoa gan"],
    prevention: ["Kiểm soát vòng bụng — quan trọng hơn số cân", "Khám sức khỏe có siêu âm ổ bụng hằng năm"],
    sources: ["AASLD — NAFLD Practice Guidance 2023", "EASL-EASD-EASO Clinical Practice Guidelines"] },

  { title: "Nghẹt mũi khiến bé ngủ khò khè: bệnh VA và điều trị đúng lúc", category: "Tai mũi họng", spec: "tai-mui-hong",
    summary: "VA (tổn sao malware) quá phát gặp ở 30% trẻ 3–7 tuổi. Nhận biết sớm giúp điều trị nội khoa kịp thời, tránh phẫu thuật không cần thiết và hạn chế tai giữa tái phát.",
    body: "Bé ngủ ngáy, miệng háp, trở mình liên tục, sáng dậy mệt mỏi, nghe kém và hay viêm tai giữa — cha mẹ thường nghĩ 'trẻ lớn lên sẽ hết'. Nhưng VA quá phát kéo dài không chỉ làm con thiếu ngủ mà còn ảnh hưởng phát triển khuôn mặt (adenoid face) và gây viêm tai giữa tái phát. Nhận biết đúng lúc là chìa khóa điều trị.",
    sections: [
      { heading: "VA là gì và khi nào là quá phát?", body: "VA là tổn sao miễn dịch nằm sau mũi, to lên tự nhiên ở 3–7 tuổi và thu nhỏ sau 10 tuổi. VA quá phát là khi khối này chặn 1/2 trở lên khoang mũi sau, gây nghẹt mũi kéo dài, chảy nước mũi sau họng, ho mạn tính và giảm thính lực do bít vòi nhĩ." },
      { heading: "Bốn dấu hiệu nhận biết tại nhà", body: "1) Ngáy đều mỗi đêm kèm miệng háp. 2) Nghe phải quay đầu, tăng âm lượng tivi. 3) Viêm tai giữa tái phát trên 3 lần/6 tháng. 4) Nói mũi, thở miệng ban ngày, 'mặt VA' — mũi hếch, miệng luôn mở, hàm trên hẹp." },
      { heading: "Điều trị nội khoa — bước đầu tiên", body: "Xịt corticoid mũi 6–12 tuần theo chỉ định giảm rõ thể tích VA ở đa số trẻ. Điều trị dị ứng đi kèm (test dị nguyên khi nghi ngờ), kiểm soát viêm mũi xoang, tránh khói thuốc. Ghi lại tình trạng ngủ bằng video để bác sĩ đánh giá tiến triển khách quan." },
      { heading: "Chỉ định phẫu thuật nạo VA", body: "Bít tắc nặng (>75% khoang mũi sau), ngưng thở khi ngủ có triệu chứng, viêm tai giữa tái phát thất bại nội khoa, viêm xoang mạn tái đi tái lại, hoặc chậm phát triển do thiếu ngủ kéo dài. Phẫu thuật nội soi hiện đại an toàn, bé về nhà trong ngày." },
    ],
    takeaways: ["Trẻ ngáy đều mỗi đêm kèm há miệng là tín hiệu cần khám TMH", "Xịt steroid mũi theo hướng dẫn giúp phần lớn trẻ tránh phẫu thuật", "Nghe kém kéo dài ở trẻ ảnh hưởng phát triển ngôn ngữ — đừng chờ"],
    warnings: ["Ngưng thở khi ngủ, tím môi, li bì → khám ngay", "Đau tai dữ dội kèm sốt cao, chảy mủ tai → viêm tai giữa cấp cần điều trị sớm"],
    prevention: ["Không hút thuốc trong nhà có trẻ", "Điều trị triệt để viêm mũi dị ứng — yếu tố làm VA to lên"],
    sources: ["AAO-HNS — Pediatric OSA guideline", "Bộ Y tế — Phác đồ TMH nhi"] },

  { title: "Vận động cho người già: tập đúng để chống té ngã và loãng xương", category: "Sức khỏe gia đình", spec: "noi-tong-hop",
    summary: "Té ngã là nguyên nhân chấn thương hàng đầu ở người trên 65. Bài tập thăng bằng kết hợp kháng lực giảm 35% nguy cơ té ngã và duy trì xương chắc khỏe.",
    body: "Sau 60 tuổi, mỗi té ngã có thể là ranh giới giữa sống tự lập và phụ thuộc con cái — gãy cổ xương đùi làm 20% người cao tuổi qua đời trong năm đầu sau chấn thương. Nhưng tin tích cực: vận động đúng cách ở mọi tuổi đều giúp cơ bắp và xương 'nợ dần' chậm lại, thậm chí tăng lại phần nào.",
    sections: [
      { heading: "Bốn trụ cột tập luyện", body: "1) Thăng bằng: đứng một chân tựa tường, đi gót-chân mũi theo đường thẳng, tai chi. 2) Kháng lực: cao su kháng lực hoặc tạ nhẹ 2 buổi/tuần, tập toàn thân 8–12 lần/lượt. 3) Aerobic: đi bộ 30 phút/ngày, bơi, đạp xe cố định. 4) Linh hoạt: giãn cơ sau tập, yoga nhẹ nhàng." },
      { heading: "Chương trình chống té ngã 12 tuần", body: "Tuần 1–4: tập thăng bằng hai chân đứng gần tường, nhắm mắt 10 giây, đi trong nhà không vướng víu. Tuần 5–8: đứng một chân 15 giây mỗi bên, bước lên bậc thấp, cao su kháng lực tay chân. Tuần 9–12: kết hợp đi bộ ngoài trời mặt phẳng, tăng thời lượng lên 40 phút, bài tập toàn thân với tạ 1–2kg." },
      { heading: "Dinh dưỡng xương khớp", body: "Canxi 1000–1200mg/ngày từ sữa, cua, tôm nhỏ, rau xanh đậm. Vitamin D 800–1000 IU/ngày — phơi nắng sáng 15 phút hoặc bổ sung theo xét nghiệm. Đạm đủ 1,0–1,2g/kg cân nặng giúp giữ khối cơ — người già ăn quá ít thịt dễ sarcopenia (teo cơ)."},
      { heading: "Nhà cửa an toàn và khi nào nên tập có giám sát", body: "Thảm chống trượt trong nhà tắm, đèn ngủ đường đi vệ sinh đêm, tay nắm bên toilet, bàn là vật vướng lối đi. Người có bệnh tim phổi không kiểm soát, huyết áp chưa ổn, hoặc từng té nhiều lần — cần đánh giá y khoa và tập có giám sát tại đơn vị phục hồi chức năng." },
    ],
    takeaways: ["Tập thăng bằng là bài tập 'vắc-xin chống té ngã' rẻ nhất", "Đạm và vitamin D quan trọng ngang bài tập cho cơ xương", "Người già vẫn tăng được cơ bắp — không bao giờ quá muộn"],
    warnings: ["Đau ngực, choáng khi tập → dừng ngay và báo bác sĩ", "Té nhiều lần trong 6 tháng dù chưa chấn thương → đánh giá nguy cơ té ngã chuyên sâu"],
    prevention: ["Duy trì tập 150 phút/tuần kết hợp thăng bằng 3 buổi/tuần", "Khám mắt và chân định kỳ — thị lực kém và đau chân là nguyên nhân té phổ biến"],
    sources: ["WHO — Guidelines on physical activity 2020", "US Preventive Services Task Force — Fall Prevention 2024"] },
];

async function phaseArticles(admin) {
  const existing = await get("/admin/articles?size=100", admin);
  const haveSlugs = new Set((existing.content ?? existing).map((a) => a.slug));
  for (const [i, a] of ARTICLES.entries()) {
    const slug = a.title.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/[^a-z0-9\s-]/g, "").trim()
      .replace(/\s+/g, "-").slice(0, 80);
    if (haveSlugs.has(slug)) { record("articles", "exists", slug, "SKIP"); continue; }
    try {
      await post("/admin/articles", admin, {
        title: a.title, slug, summary: a.summary, body: a.body,
        category: a.category,
        authorName: ["TS.BS Trần Thu Hà", "BS.CKII Trịnh Anh Dũng", "TS.BS Lê Thu Trang",
          "ThS.BS Đặng Mỹ Linh", "BS.CKI Phan Quốc Việt", "ThS.BS Phạm Hoàng Yến"][i % 6],
        readingMinutes: 5 + (i % 4),
        relatedSpecialtySlug: a.spec,
        contentKind: "DISEASE_GUIDE",
        coverImageUrl: ARTICLE_COVERS[i % ARTICLE_COVERS.length],
        seoTitle: a.title.slice(0, 180),
        seoDescription: a.summary.slice(0, 300),
        tags: [a.category, "sức khỏe", "HealthCare"],
        topicTags: [a.spec, "chăm sóc"],
        keyTakeaways: a.takeaways,
        warningSigns: a.warnings,
        preventionTips: a.prevention,
        whenToSeekCare: a.warnings[0],
        sourceReferences: a.sources,
        clinicalDisclaimer: "Nội dung chỉ mang tính thông tin tham khảo, không thay thế thăm khám và chỉ định của bác sĩ.",
        featured: i < 3,
        active: true,
        sections: a.sections,
      });
      record("articles", "create", slug, "OK");
    } catch (e) {
      if (e.status === 409) record("articles", "exists (409)", slug, "SKIP");
      else record("articles", "create", `${slug}: ${e.message} ${JSON.stringify(e.data ?? {}).slice(0, 200)}`, "FAIL");
    }
  }
}

// ── PHASE 4b: clinical review for DISEASE_GUIDE articles ────────────────────
// Public DISEASE_GUIDE listing requires an APPROVED clinical-review head.
// ai_content_revisions rows are normally written server-side by
// AiClinicalContentRevisionService.record() whenever AdminArticleService
// creates/updates an article, so most articles already have a DRAFT head.
// This phase backfills a missing revision with the exact same canonical
// snapshot + sha256 the service computes (see canonicalSnapshot/canonicalHash),
// then walks the real workflow: ADMIN submit → DOCTOR APPROVE.

const ARTICLE_SNAPSHOT_JSONB = `jsonb_build_object(
      'active', active, 'author_name', author_name, 'body', body,
      'category', category, 'id', id::text, 'reading_minutes', reading_minutes,
      'related_specialty_slug', related_specialty_slug, 'published_at', published_at,
      'sections', sections, 'slug', slug, 'summary', summary, 'title', title)`;

function ensureArticleRevision(articleId, adminId) {
  runSql(`WITH snap AS (
      SELECT ${ARTICLE_SNAPSHOT_JSONB} AS j FROM articles WHERE id = '${articleId}'
    ), cur AS (
      SELECT content_revision, eligibility_revision FROM ai_content_review_heads
       WHERE source_type = 'ARTICLE' AND source_id = '${articleId}' FOR UPDATE
    ), rev AS (
      INSERT INTO ai_content_revisions(
          source_type, source_id, content_revision, content_hash,
          content_snapshot, created_by)
      SELECT 'ARTICLE', '${articleId}',
             COALESCE((SELECT content_revision FROM cur), 0) + 1,
             encode(digest(convert_to(j::text, 'UTF8'), 'sha256'), 'hex'), j, '${adminId}'
      FROM snap
      ON CONFLICT (source_type, source_id, content_revision) DO NOTHING
      RETURNING content_revision, content_hash
    )
    INSERT INTO ai_content_review_heads(
        source_type, source_id, content_revision, content_hash,
        eligibility_revision, eligibility_state, edited_by)
    SELECT 'ARTICLE', '${articleId}', r.content_revision, r.content_hash,
           COALESCE((SELECT eligibility_revision FROM cur), 0) + 1, 'DRAFT', '${adminId}'
    FROM rev r
    ON CONFLICT (source_type, source_id) DO UPDATE
      SET content_revision = EXCLUDED.content_revision,
          content_hash = EXCLUDED.content_hash,
          eligibility_revision = ai_content_review_heads.eligibility_revision + 1,
          eligibility_state = 'DRAFT', current_approval_round = NULL,
          submitted_at = NULL, approved_at = NULL, approval_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP;`);
}

function articleHead(articleId) {
  const row = sqlScalar(`select content_revision || '|' || content_hash || '|' || eligibility_state
      from ai_content_review_heads
      where source_type = 'ARTICLE' and source_id = '${articleId}'`);
  return row ? row.split("|") : null;
}

async function phaseClinicalReview(admin, ctx) {
  const doctor = ctx.doctors["doctor@healthcare.com"];
  if (!doctor) {
    record("clinical-review", "session", "doctor@healthcare.com login unavailable", "FAIL");
    return;
  }
  const adminId = sqlScalar("select id from users where email='admin@healthcare.com'");
  const rows = sqlScalar(`select string_agg(id::text || '|' || slug, chr(10) order by title)
      from articles where content_kind = 'DISEASE_GUIDE' and active`)
    .split("\n").filter(Boolean);
  const articles = rows.map((line) => {
    const cut = line.indexOf("|");
    return { id: line.slice(0, cut), slug: line.slice(cut + 1) };
  });
  if (articles.length === 0) { warn("no active DISEASE_GUIDE articles to review"); return; }

  let approved = 0;
  for (const a of articles) {
    let [revision, contentHash, state] = articleHead(a.id) ?? [];
    if (!revision) {
      ensureArticleRevision(a.id, adminId);
      [revision, contentHash, state] = articleHead(a.id) ?? [];
      record("clinical-review", "backfill revision", `${a.slug} → r${revision}`, revision ? "OK" : "FAIL");
      if (!revision) continue;
    }
    if (state === "APPROVED") {
      approved += 1;
      record("clinical-review", "already approved", a.slug, "SKIP");
      continue;
    }
    if (state !== "SUBMITTED") {
      try {
        await put(`/admin/ai-content/ARTICLE/${a.id}/submission`, admin,
          { revision: Number(revision), contentHash });
        record("clinical-review", "submit", `${a.slug} r${revision}`, "OK");
      } catch (e) {
        record("clinical-review", "submit", `${a.slug}: ${e.message}`, "FAIL");
        continue;
      }
    } else {
      record("clinical-review", "already submitted", a.slug, "SKIP");
    }
    try {
      await put(`/doctor/ai-content/ARTICLE/${a.id}/revisions/${revision}/decision?round=0`, doctor,
        { decision: "APPROVE",
          reason: "Nội dung đúng chuyên môn, đầy đủ cảnh báo và hướng dẫn cho bệnh nhân — phê duyệt xuất bản." });
      approved += 1;
      record("clinical-review", "approve", a.slug, "OK");
    } catch (e) {
      record("clinical-review", "approve", `${a.slug}: ${e.message}`, "FAIL");
    }
  }
  ok(`clinical-review: ${approved}/${articles.length} articles APPROVED`);
}

// ── PHASE 5: patient accounts ───────────────────────────────────────────────

const PATIENTS = [
  { email: "mai.tran.2603@gmail.com", name: "Trần Thị Mai", alias: "Mai T", phone: "0901000001" },
  { email: "hung.le.1975@gmail.com", name: "Lê Văn Hùng", alias: "Hung L", phone: "0901000002" },
  { email: "ngocanh.pham.1992@gmail.com", name: "Phạm Ngọc Anh", alias: "Ngoc A", phone: "0901000003" },
  { email: "quang.nguyen.1980@gmail.com", name: "Nguyễn Đình Quang", alias: "Quang N", phone: "0901000004" },
  { email: "hong.vu.1965@gmail.com", name: "Vũ Thị Hồng", alias: "Hong V", phone: "0901000005" },
  { email: "minhtuan.do.1995@gmail.com", name: "Đỗ Minh Tuấn", alias: "Tuan D", phone: "0901000006" },
  { email: "thaovy.hoang.1990@gmail.com", name: "Hoàng Thảo Vy", alias: "Thao V", phone: "0901000007" },
  { email: "giabao.bui.2016@gmail.com", name: "Bùi Gia Bảo", alias: "Me Be Bao", phone: "0901000008" },
  { email: "thanhtham.ngo.1972@gmail.com", name: "Ngô Thanh Tâm", alias: "Tam N", phone: "0901000009" },
  { email: "quocbao.ly.1983@gmail.com", name: "Lý Quốc Bảo", alias: "Bao L", phone: "0901000010" },
];

async function registerPatients() {
  const sessions = {};
  for (const p of PATIENTS) {
    const existsUser = sqlScalar(`select count(*) from users where email='${p.email}'`);
    if (existsUser !== "0") {
      try {
        sessions[p.email] = await login(p.email);
        record("patients", "exists+login", p.email, "SKIP");
      } catch (e) {
        if (!String(e.message).includes("EMAIL_VERIFICATION_REQUIRED")) {
          record("patients", "login failed", `${p.email}: ${e.message}`, "FAIL");
          continue;
        }
        try {
          await post("/auth/email-verifications/resend", null, { email: p.email });
          const otp = await mailpitOtp(p.email, { notBefore: Date.now() - 5000, attempt: 2 });
          const s = new Session(p.email);
          await post("/auth/browser-sessions", s, {
            grantType: "EMAIL_VERIFICATION", email: p.email, code: otp,
          });
          sessions[p.email] = s;
          record("patients", "verified+login", p.email, "OK");
        } catch (e2) {
          record("patients", "verify", `${p.email}: ${e2.message}`, "FAIL");
        }
      }
      continue;
    }
    try {
      await post("/auth/register", null, {
        email: p.email, password: PWD, displayName: p.name,
        phone: p.phone,
      });
      const otp = await mailpitOtp(p.email, { notBefore: Date.now() - 5000 });
      const s = new Session(p.email);
      await post("/auth/browser-sessions", s, {
        grantType: "EMAIL_VERIFICATION", email: p.email, code: otp,
      });
      sessions[p.email] = s;
      record("patients", "registered", p.email, "OK");
    } catch (e) {
      record("patients", "register", `${p.email}: ${e.message}`, "FAIL");
    }
  }
  return sessions;
}

// ── PHASE 6: article comments ───────────────────────────────────────────────

const COMMENTS = [
  "Bài viết rất dễ hiểu, đã in ra cho bố mẹ em đọc. Mong ban biên tập làm thêm bài về rung nhĩ ạ.",
  "Em bị đau ngực khi leo cầu thang, đọc xong hẹn lịch khám ngay tuần này. Cảm ơn bác sĩ!",
  "Mục thực đơn DASH điều chỉnh khẩu phần Việt rất thực tế, em đã giảm được 4kg sau 2 tháng.",
  "Con em biếng ăn từ bé, áp dụng nguyên tắc không áp lực được 2 tuần thì bữa ăn đã vui hơn hẳn.",
  "Cảm ơn bác sĩ. Vậy người bị huyết áp thấp có áp dụng giảm muối như vậy được không ạ?",
  "Bài tập chin tuck đúng là hiệu quả, làm được 3 tuần giảm đau cổ rõ rệt. Làm việc máy tính nên đọc bài này.",
  "Mình 32 tuổi khám tổng quát phát hiện tiền tiểu đường, đọc bài này động lực giảm cân liền.",
  "Chuẩn bị nội soi dạ dày mà không biết tránh dưa hấu, may đọc bài này kịp. Cảm ơn bệnh viện!",
  "Mang thai tháng thứ 4, bài viết giúp em hiểu rõ NIPT hơn thay vì lo lắng vô ích. Thank you bác sĩ Trang!",
  "Em bị viêm mũi dị ứng 10 năm, rửa mũi nước muối mỗi sáng thật sự hiệu quả hơn tưởng tượng.",
  "Chân em nổi gân xanh về tối phù, phần tất áp lực giải thích rất rõ. Sẽ đi siêu âm doppler tuần này.",
  "Cháu nhà em viêm phế quản, đọc bài xong an tâm không đòi kháng sinh nữa. Bác sĩ nói đúng ý bài viết.",
  "Em bị PCOS 5 năm, phần giảm 5-10% cân nặng đúng như bác sĩ đã dặn. Mong có bài sâu về thực đơn PCOS ạ.",
  "Quy tắc 20-20-20 áp dụng được ngay, mắt đỡ cay xè hẳn buổi chiều. Cảm ơn bệnh viện đã viết chi tiết vậy.",
  "Bố em 68 tuổi từng té ở nhà tắm, bài viết nhắc nhà cửa an toàn đúng tâm can gia đình chúng em.",
];
const DOCTOR_REPLIES = [
  "Cảm ơn bạn đã theo dõi. Với huyết áp thấp, nguyên tắc giảm muối cần điều chỉnh — bạn nên khám để đánh giá riêng, không áp dụng máy móc mục tiêu 5g/ngày.",
  "Đúng vậy, rung nhĩ là chủ đề quan trọng. Chúng tôi đã có kế hoạch bài viết chuyên sâu về rung nhĩ và thuốc chống đông trong tháng tới.",
  "Chúc mừng bạn! Hãy duy trì nhật ký huyết áp tại nhà và mang kết quả đến buổi tái khám để điều chỉnh thêm nhé.",
];

async function phaseComments(patientSessions, doctorSession) {
  const articles = await get("/hospital/articles?size=50", null);
  const list = (articles.content ?? articles).filter((a) => a.active !== false);
  if (list.length === 0) { warn("no active articles for comments"); return; }
  const emails = Object.keys(patientSessions);
  let ci = 0;
  for (const a of list.slice(0, 15)) {
    const email = emails[ci % emails.length];
    const s = patientSessions[email];
    if (!s) { ci += 1; continue; }
    try {
      const created = await post(`/hospital/articles/${a.slug}/comments`, s, { content: COMMENTS[ci % COMMENTS.length] });
      if (ci < DOCTOR_REPLIES.length) {
        await post(`/hospital/articles/${a.slug}/comments`, doctorSession,
          { content: DOCTOR_REPLIES[ci], parentCommentId: created.id }).catch(() => {});
      }
      record("comments", "create", `${a.slug} (${email.split("@")[0]})`, "OK");
    } catch (e) {
      record("comments", "create", `${a.slug}: ${e.message}`, "FAIL");
    }
    ci += 1;
  }
}

// ── PHASE 7: health Q&A ─────────────────────────────────────────────────────

const QUESTIONS = [
  { spec: "tim-mach", q: "Bố em 68 tuổi bị tăng huyết áp 15 năm, gần đây hay tê tay trái. Có phải dấu hiệu đột quỵ không và cần làm gì ạ?", alias: "Mai T" },
  { spec: "tim-mach", q: "Em 45 tuổi, huyết áp 135/85, chưa dùng thuốc. Có cần đo huyết áp tại nhà không và nên đo lúc nào ạ?", alias: "Hung L" },
  { spec: "tieu-hoa", q: "Em hay đau thượng vị lúc đói buổi sáng, ăn vào đỡ. Có phải loét tá tràng không, cần nội soi ngay không ạ?", alias: "Quang N" },
  { spec: "tieu-hoa", q: "Siêu âm báo gan nhiễm mỡ độ 2, em không uống rượu. Chế độ ăn nên kiêng gì và có thuốc đặc trị không ạ?", alias: "Tuan D" },
  { spec: "nhi-khoa", q: "Bé nhà em 3 tuổi ngáy to và ngủ há miệng mỗi đêm, ban ngày vẫn chơi bình thường. Có cần khám VA không ạ?", alias: "Me Be Bao" },
  { spec: "nhi-khoa", q: "Bé 18 tháng biếng ăn, cân nặng đứng cuối biểu đồ WHO. Có nên bổ sung kẽm không hay phải xét nghiệm ạ?", alias: "Thao V" },
  { spec: "san-phu-khoa", q: "Em 31 tuổi, kinh nguyệt 2-3 tháng mới một lần, mụn nhiều ở cằm. Có phải hội chứng buồng trứng đa nang không ạ?", alias: "Ngoc A" },
  { spec: "san-phu-khoa", q: "Sinh thường được 8 tháng, em bị tiểu rỉ khi hắt hơi. Tập kegel có hiệu quả không và bắt đầu từ khi nào ạ?", alias: "Hong V" },
  { spec: "than-kinh", q: "Em mất ngủ mạn tính 2 năm, phụ thuộc thuốc ngủ. Muốn ngưng thuốc phải làm thế nào ạ?", alias: "Tam N" },
  { spec: "than-kinh", q: "Em bị đau nửa đầu 2-3 lần/tháng, thuốc giảm đau không đỡ nữa. Có cần chụp MRI não không ạ?", alias: "Bao L" },
  { spec: "co-xuong-khop", q: "Em làm văn phòng, đau cổ lan xuống tê tay phải 2 tháng. Có cần chụp MRI cột sống cổ không ạ?", alias: "Hung L" },
  { spec: "tai-mui-hong", q: "Con em 6 tuổi viêm tai giữa 3 lần trong 6 tháng. Bác sĩ nói có thể do VA. Nên điều trị nội khoa hay phẫu thuật ạ?", alias: "Me Be Bao" },
  { spec: "noi-tong-hop", q: "Em 52 tuổi khám định kỳ nên làm những hạng mục nào? Có gói khám riêng cho tuổi này không ạ?", alias: "Hong V" },
  { spec: "tim-mach", q: "Chân em nổi gân xanh bè ra, phù về tối. Dùng tất áp lực loại nào và mua ở đâu là chuẩn ạ?", alias: "Mai T" },
  { spec: "san-phu-khoa", q: "Mang thai 12 tuần, Double test nguy cơ trung bình 1/800. Em có nên làm NIPT thêm không hay chờ Triple test ạ?", alias: "Thao V" },
];

async function phaseHealthQA(patientSessions, doctorSessions, admin) {
  const answered = [];
  for (const [i, item] of QUESTIONS.entries()) {
    const emails = Object.keys(patientSessions);
    const email = emails[i % Math.max(emails.length, 1)];
    const s = patientSessions[email];
    if (!s) continue;
    try {
      // idempotency: skip if this patient already asked the same question
      const mine = await get("/patient/health-questions", s).catch(() => []);
      const mineList = Array.isArray(mine) ? mine : mine.content ?? [];
      if (mineList.some((x) => x.question === item.q)) {
        record("health-qa", "question exists", `${item.spec} — ${item.alias}`, "SKIP");
        continue;
      }
      const created = await post("/patient/health-questions", s,
        { topicSlug: item.spec, question: item.q, publicAlias: item.alias });
      answered.push(created);
      record("health-qa", "question", `${item.spec} — ${item.alias}`, "OK");
    } catch (e) {
      record("health-qa", "question", `${item.spec}: ${e.message}`, "FAIL");
    }
  }
  for (const q of answered) {
    await put(`/admin/health-questions/${q.id}/moderation`, admin, { decision: "APPROVE" })
      .catch((e) => record("health-qa", "moderate", q.id, `FAIL ${e.message}`));
  }
  const doctorEmails = ["dung.trinh@healthcare.local", "trang.le@healthcare.local",
    "viet.phan@healthcare.local"];
  const replies = [
    "Huyết áp 135/85 thuộc vùng tăng huyết áp độ 1 theo ESC. Bạn nên đo huyết áp tại nhà 7 ngày liền, sáng tối sau 5 phút nghỉ, ghi nhật ký và mang đến bác sĩ. Nếu trung bình tại nhà trên 135/85, bác sĩ sẽ cân nhắc điều chỉnh lối sống trước và thuốc khi cần.",
    "Đau thượng vị lúc đói, ăn vào đỡ là đặc điểm gợi ý loét tá tràng. Bạn nên nội soi tiêu hóa trên và xét nghiệm vi khuẩn HP để có chẩn đoán xác định. Trước đó, tránh cà phê và thuốc giảm đau nhóm NSAID lúc bụng đói.",
    "Gan nhiễm mỡ độ 2 không do rượu có thể cải thiện rõ bằng giảm 7% cân nặng trong 6 tháng, cắt nước ngọt và tinh bột tinh chế, vận động 150 phút/tuần. Hiện chưa có 'thuốc đặc trị' cho giai đoạn này — điều quan trọng là tái khám men gan và FibroScan 6 tháng/lần.",
    "Bé ngáy đều mỗi đêm kèm há miệng là dấu hiệu gợi ý VA quá phát. Bạn nên đưa bé khám Tai Mũi Họng để bác sĩ nội soi đánh giá mức độ bít tắc. Trước đó, tránh khói thuốc và điều trị viêm mũi nếu có.",
    "Biếng ăn kèm cân nặng thấp cần bác sĩ đánh giá đường cong tăng trưởng trước khi bổ sung vi chất. Tự cho kẽm không có chỉ định có thể ảnh hưởng hấp thu sắt. Hãy làm xét nghiệm huyết học và kẽm máu nếu bác sĩ chỉ định sau thăm khám.",
    "Kinh thưa kèm mụn ở cằm là bộ ba gợi ý hội chứng buồng trứng đa nang. Bạn nên khám nội tiết sinh sản: siêu âm buồng trứng ngày 3-5 chu kỳ và xét nghiệm hormone. Giảm 5-10% cân nặng nếu thừa cân giúp cải thiện rõ ràng chu kỳ kinh nguyệt.",
    "Tiểu rỉ khi hắt hơi sau sinh là dấu hiệu sàn chậu yếu, hoàn toàn cải thiện được bằng tập kegel đúng kỹ thuật. Bạn có thể bắt đầu ngay bây giờ: siết cơ sàn chậu 5 giây, thả 5 giây, 10 lần mỗi hiệp, 3 hiệp/ngày. Nếu sau 8-12 tuần không tiến triển, hãy khám phục hồi chức năng sàn chậu.",
    "Ngưng thuốc ngủ cần có lộ trình giảm dần dưới hướng dẫn bác sĩ, không cắt đột ngột. Song song đó, trị liệu nhận thức hành vi cho mất ngủ (CBT-I) là phương pháp hiệu quả dài hạn nhất: dậy đúng giờ, giới hạn thời gian nằm trên giường, và kiểm soát lo lắng về giấc ngủ.",
    "Đau nửa đầu tăng tần suất và thuốc giảm đau kém hiệu quả là lý do chính đáng để đánh giá lại chẩn đoán. MRI não giúp loại trừ nguyên nhân khác, và bác sĩ có thể cân nhắc thuốc dự phòng nếu cơn trên 4 lần/tháng. Ghi nhật ký đau đầu để tìm yếu tố khởi phát.",
    "Đau cổ lan tê tay kéo dài 2 tháng có dấu hiệu chèn ép rễ thần kinh. MRI cột sống cổ là chỉ định hợp lý sau khi điều trị bảo tồn không cải thiện. Trong lúc chờ, điều chỉnh màn hình ngang mắt và thực hiện bài tập chin tuck đều đặn.",
    "Viêm tai giữa tái phát trên 3 lần trong 6 tháng thường liên quan VA quá phát bít vòi nhĩ. Phác đồ chuẩn là điều trị nội khoa và xịt corticoid mũi trước; phẫu thuật nạo VA được cân nhắc khi thất bại nội khoa hoặc có ngưng thở khi ngủ. Bé cần được khám TMH đánh giá cụ thể.",
    "Ở tuổi 52, gói khám nên gồm: xét nghiệm máu toàn diện, mỡ máu, đường huyết HbA1c, siêu âm ổ bụng, nội soi dạ dày (nếu chưa từng), tầm soát ung thư đại trực tràng, phụ nữ thêm nhũ ảnh và đo loãng xương. HealthCare có gói sức khỏe người cao tuổi phù hợp chuyển tiếp khi bạn 60 tuổi.",
    "Gân xanh nổi kèm phù chiều gợi ý suy tĩnh mạch chi dưới. Bạn nên siêu âm Doppler tĩnh mạch trước khi chọn tất áp lực — cỡ tất phải đo vòng cổ chân và bắp chân. Áp lực thường dùng là 20-30 mmHg, mang buổi sáng trước khi xuống giường.",
    "Double test nguy cơ trung bình 1/800 là vùng xám mà NIPT giúp phân tầng tốt hơn nhờ độ chính xác trên 99% với hội chứng Down. Bạn có thể trao đổi với bác sĩ sản phụ khoa về NIPT ngay bây giờ — không nhất thiết chờ Triple test, vì NIPT làm từ tuần 10 trở đi.",
  ];
  // process the whole admin queue (also recovers questions pending from prior runs)
  let queue = [];
  try {
    queue = await get("/admin/health-questions", admin);
    if (!Array.isArray(queue)) queue = queue.content ?? [];
  } catch (e) {
    warn(`admin queue unavailable: ${e.message}`);
  }
  let ri = 0;
  for (const q of queue) {
    if (q.status === "AWAITING_DOCTOR") {
      const doctorEmail = doctorEmails[ri % doctorEmails.length];
      const ds = doctorSessions[doctorEmail];
      ri += 1;
      if (!ds) continue;
      try {
        await put(`/doctor/health-questions/${q.id}/answer`, ds,
          { answer: replies[ri % replies.length] });
        record("health-qa", "answered", `${q.id.slice(0, 8)} by ${doctorEmail.split("@")[0]}`, "OK");
      } catch (e) {
        record("health-qa", "answer", `${q.id.slice(0, 8)}: ${e.message}`, "FAIL");
      }
    }
    if (q.status === "ANSWER_SUBMITTED") {
      // four-eyes rule: a DIFFERENT doctor must approve the answer
      let approved = false;
      for (const reviewerEmail of doctorEmails) {
        const reviewer = doctorSessions[reviewerEmail];
        if (!reviewer) continue;
        try {
          await put(`/doctor/health-questions/${q.id}/decision`, reviewer, { decision: "APPROVE" });
          record("health-qa", "approved", `${q.id.slice(0, 8)} by ${reviewerEmail.split("@")[0]}`, "OK");
          approved = true;
          break;
        } catch (e) {
          if (!String(e.message).includes("SELF_APPROVAL")) {
            record("health-qa", "approve", `${q.id.slice(0, 8)}: ${e.message}`, "FAIL");
            break;
          }
        }
      }
      if (!approved) record("health-qa", "approve", q.id.slice(0, 8), "SKIP");
    }
  }
  // questions still PENDING stay visible in the admin queue for dogfood
}

// ── PHASE 8: appointments (hold → OTP → confirm) ────────────────────────────

async function findSlot(doctorId, dayOfWeek) {
  const date = nextWeekday(new Date(), dayOfWeek);
  const times = ["08:00", "08:30", "09:00", "09:30", "10:00", "13:30", "14:00", "14:30"];
  return { date, time: times[Math.floor(Math.random() * times.length)] };
}

async function phaseAppointments(patientSessions, admin) {
  const doctors = await get("/hospital/doctors?size=100", null);
  const dlist = (doctors.content ?? doctors).filter((d) => d.active !== false);
  const branches = await get("/hospital/branches?size=50", null);
  const branch = branches[0] ?? branches.content?.[0];
  const appointments = [];
  const emails = Object.keys(patientSessions);
  const targets = [
    { doctorSlug: "bs-trinh-anh-dung", emailIdx: 0, day: 2, reason: "Tái khám tăng huyết áp, muốn đánh giá lại thuốc điều trị và chế độ ăn." },
    { doctorSlug: "tsbs-le-thu-trang", emailIdx: 2, day: 1, reason: "Khám thai định kỳ tuần 13, đo độ mờ da gáy và tư vấn sàng lọc." },
    { doctorSlug: "bs-phan-quoc-viet", emailIdx: 3, day: 5, reason: "Đau thượng vị lúc đói 3 tuần, cần nội soi dạ dày và xét nghiệm HP." },
    { doctorSlug: "thsbs-dang-my-linh", emailIdx: 7, day: 1, reason: "Bé 3 tuổi ngáy đêm, cần khám tai mũi họng — nhi khoa đánh giá VA." },
    { doctorSlug: "bs-hoang-gia-huy", emailIdx: 8, day: 3, reason: "Mất ngủ mạn tính 2 năm, đau nửa đầu tăng tần suất." },
    { doctorSlug: "bs-trinh-anh-dung", emailIdx: 1, day: 4, reason: "Nổi gân xanh chân, phù về tối, cần siêu âm Doppler tĩnh mạch." },
    { doctorSlug: "thsbs-dang-my-linh", emailIdx: 6, day: 4, reason: "Bé biếng ăn, cân nặng chậm tăng, cần đánh giá dinh dưỡng." },
    { doctorSlug: "bs-phan-quoc-viet", emailIdx: 5, day: 2, reason: "Siêu âm gan nhiễm mỡ độ 2, tư vấn chế độ dinh dưỡng và theo dõi men gan." },
  ];
  for (const t of targets) {
    const s = patientSessions[emails[t.emailIdx % emails.length]];
    if (!s) continue;
    const doctor = dlist.find((d) => d.slug === t.doctorSlug);
    if (!doctor) { warn(`doctor ${t.doctorSlug} not found`); continue; }
    const { date, time } = await findSlot(doctor.id, t.day);
    const patientInfo = PATIENTS.find((p) => p.email === emails[t.emailIdx % emails.length]);
    try {
      const hold = await post("/appointments/hold", s, {
        doctorId: doctor.id, appointmentDate: date, startTime: time,
        fullName: patientInfo?.name ?? "Bệnh nhân demo",
        phone: patientInfo?.phone,
        email: s.email, reasonForVisit: t.reason, branchId: branch?.id,
        hasInsurance: Math.random() > 0.5,
        privacyConsent: true,
      });
      await new Promise((r) => setTimeout(r, 1200));
      const otp = await mailpitOtp(s.email, { notBefore: Date.now() - 5000 });
      const confirmed = await post("/appointments/confirm", s,
        { bookingCode: hold.bookingCode, otpCode: otp, notes: t.reason });
      appointments.push({ appointment: confirmed, email: s.email, doctorSlug: t.doctorSlug });
      record("appointments", "booked", `${t.doctorSlug} ${date} ${time} → ${emails[t.emailIdx % emails.length].split("@")[0]}`, "OK");
    } catch (e) {
      record("appointments", "book", `${t.doctorSlug} ${date}: ${e.message}`, "FAIL");
    }
  }
  return appointments;
}

// ── PHASE 9: consultations ──────────────────────────────────────────────────

async function phaseConsultations(appointments, patientSessions, doctorSessions) {
  const threads = [];
  const subjects = [
    { subject: "Tư vấn điều chỉnh thuốc huyết áp sau đo 24 giờ", msgs: [
      ["patient", "Chào bác sĩ, em vừa đo huyết áp 24 giờ xong, kết quả trung bình ngày 148/92. Em có nên tăng liều amlodipine không ạ?"],
      ["doctor", "Chào bạn, trung bình 148/92 vẫn còn trên mục tiêu. Trước khi tăng liều, mình cần xem bạn đã giảm muối và ngủ đủ chưa — hãy ghi nhật ký ăn uống 3 ngày và gửi kèm kết quả đo sáng tối nhé."],
      ["patient", "Dạ em sẽ ghi lại. Em thường ăn ngoài nhiều, có lẽ muối khá cao. Em gửi kết quả sau 3 ngày ạ."],
    ] },
    { subject: "Kết quả Double test và kế hoạch NIPT", msgs: [
      ["patient", "Dạ bác sĩ, em vừa nhận kết quả Double test 1/800. Bác sĩ khuyên làm NIPT. Em nên làm ở tuần bao nhiêu là phù hợp ạ?"],
      ["doctor", "Kết quả 1/800 thuộc nhóm nguy cơ trung bình. NIPT có thể làm ngay từ bây giờ vì em đã qua tuần 12. Kết quả NIPT nguy cơ thấp giúp em an tâm, nguy cơ cao thì mình sẽ chuyển bước chẩn đoán chọc ối."],
    ] },
    { subject: "Theo dõi sau nội soi dạ dày phát hiện HP (+)", msgs: [
      ["patient", "Chào bác sĩ, kết quả nội soi của em là viêm dạ dày Hang vị và HP dương tính. Lịch trình uống thuốc diệt HP 14 ngày em phải lưu ý gì ạ?"],
      ["doctor", "Bạn uống đủ 3 loại thuốc theo toa, đúng giờ, không bỏ giữa chừng — bỏ sớm là nguyên nhân kháng thuốc phổ biến nhất. Tránh rượu bia hoàn toàn trong thời gian điều trị. Sau 4 tuần ngừng thuốc, quay lại test hơi thở 13C kiểm tra."],
      ["patient", "Dạ understood. Nếu quên một liều buổi tối thì em xử lý thế nào ạ?"],
      ["doctor", "Nếu quên ít hơn 2 giờ, uống bù ngay. Quá 2 giờ thì bỏ liều đó, không uống gấp đôi vào lần kế tiếp. Ghi lại vào nhật ký để bác sĩ theo dõi tuân thủ nhé."],
    ] },
  ];
  for (const [i, t] of subjects.entries()) {
    const match = appointments.find((a) => a.doctorSlug ===
      ["bs-trinh-anh-dung", "tsbs-le-thu-trang", "bs-phan-quoc-viet"][i]);
    if (!match) continue;
    const patientEmail = match.email;
    const ps = patientSessions[patientEmail];
    const doctorEmail = ["dung.trinh@healthcare.local", "trang.le@healthcare.local",
      "viet.phan@healthcare.local"][i];
    const ds = doctorSessions[doctorEmail];
    if (!ps || !ds) continue;
    try {
      const thread = await post("/patient/consultations", ps, {
        appointmentId: match.appointment.id ?? match.appointment.appointmentId ?? match.appointment,
        subject: t.subject, consentAccepted: true, consentVersion: "consultation-v1",
      });
      threads.push(thread);
      for (const [role, body] of t.msgs) {
        const sender = role === "patient" ? ps : ds;
        await post(`/patient/consultations/${thread.id}/messages`, sender, { body })
          .catch(async () => {
            await post(`/doctor/consultations/${thread.id}/messages`, ds, { body });
          });
      }
      record("consultations", "thread", `${t.subject.slice(0, 30)}…`, "OK");
    } catch (e) {
      record("consultations", "thread", `${t.subject.slice(0, 24)}: ${e.message}`, "FAIL");
    }
  }
  return threads;
}

// ── PHASE 10: care plans ────────────────────────────────────────────────────

async function phaseCarePlans(appointments, patientSessions, doctorSessions) {
  const plans = [
    { title: "Kế hoạch kiểm soát huyết áp 8 tuần", items: [
      { goal: "Đo huyết áp sáng tối mỗi ngày và ghi nhật ký", reminder: "07:00 và 19:00 hằng ngày" },
      { goal: "Giảm muối dưới 5g/ngày, thay 1 thìa nước mắm bằng gia vị thơm", reminder: "Mỗi bữa ăn chính" },
      { goal: "Đi bộ nhanh 30 phút mỗi sáng, 5 ngày/tuần", reminder: "06:30 sáng" },
      { goal: "Tái khám tim mạch sau 8 tuần mang nhật ký huyết áp", reminder: null, dueAt: null },
    ] },
    { title: "Lộ trình diệt vi khuẩn HP và phục hồi dạ dày", items: [
      { goal: "Uống đủ 3 thuốc diệt HP đúng giờ trong 14 ngày, ghi nhật ký", reminder: "Sau ăn 30 phút — sáng, trưa, tối" },
      { goal: "Không rượu bia, không NSAID trong 4 tuần", reminder: null },
      { goal: "Ăn 4-5 bữa nhỏ, không bỏ bữa sáng", reminder: "Hằng ngày" },
      { goal: "Test hơi thở 13C kiểm tra diệt trừ HP sau 4 tuần", dueAt: null },
    ] },
    { title: "Chương trình cải thiện giấc ngủ CBT-I 6 tuần", items: [
      { goal: "Dậy 06:30 cố định kể cả cuối tuần, ghi giờ ngủ thực tế", reminder: "06:30 mỗi sáng" },
      { goal: "Không caffeine sau 14 giờ, rời giường nếu 20 phút không ngủ được", reminder: null },
      { goal: "Viết nhật ký lo âu 15 phút trước ngủ", reminder: "21:30 mỗi tối" },
      { goal: "Tái khám thần kinh đánh giá tiến triển sau 6 tuần", dueAt: null },
    ] },
  ];
  const doctorBySlug = {
    "bs-trinh-anh-dung": "dung.trinh@healthcare.local",
    "bs-phan-quoc-viet": "viet.phan@healthcare.local",
    "bs-hoang-gia-huy": null,
  };
  const planTargets = [
    { slug: "bs-trinh-anh-dung", idx: 0 },
    { slug: "bs-phan-quoc-viet", idx: 2 },
    { slug: "bs-hoang-gia-huy", idx: 1 },
  ];
  for (const t of planTargets) {
    const match = appointments.find((a) => a.doctorSlug === t.slug);
    const plan = plans[t.idx];
    if (!match) continue;
    const doctorEmail = doctorBySlug[t.slug]
      ?? Object.keys(doctorSessions).find((e) => doctorSessions[e]);
    const ds = doctorSessions[doctorEmail];
    const ps = patientSessions[match.email];
    if (!ds || !ps) continue;
    try {
      await post("/doctor/care-plans", ds, {
        appointmentId: match.appointment.id ?? match.appointment.appointmentId ?? match.appointment,
        title: plan.title,
        items: plan.items.map((it) => ({ goal: it.goal, reminder: it.reminder ?? undefined, dueAt: it.dueAt ?? undefined })),
      });
      record("care-plans", "create", plan.title, "OK");
    } catch (e) {
      record("care-plans", "create", `${plan.title}: ${e.message}`, "FAIL");
    }
  }
  // patient completes the first item of their first plan
  try {
    const mine = await get("/patient/care-plans", Object.values(patientSessions)[0]);
    const first = (mine.content ?? mine)[0];
    if (first) {
      const items = first.items ?? [];
      if (items.length > 0) {
        await post(`/patient/care-plans/items/${items[0].id}/complete`, Object.values(patientSessions)[0]);
        record("care-plans", "item complete", `${first.title} — mục đầu tiên`, "OK");
      }
    }
  } catch (e) {
    record("care-plans", "item complete", e.message, "FAIL");
  }
}

// ── PHASE 11: media uploads + CMS content ───────────────────────────────────

function tinyPng(r, g, b) {
  // Build a valid 2x2 solid-color PNG (correct CRCs — the AV/media pipeline
  // rejects images with broken chunks).
  const { deflateSync } = zlib;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const row = Buffer.from([0, r, g, b, 0, r, g, b]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat([row, row]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function uploadMedia(session, filename, buffer, purpose) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "image/png" }), filename);
  form.append("purpose", purpose);
  return post("/media/upload", session, undefined, form);
}

async function phaseMediaAndCms(admin) {
  // 1. upload a few media assets to prove the pipeline
  const uploaded = [];
  const colors = [
    ["cms-hero-tim-mach.png", [41, 128, 185]],
    ["cms-hero-noi-tong-hop.png", [39, 174, 96]],
    ["cms-banner-tu-van.png", [142, 68, 173]],
  ];
  for (const [name, [r, g, b]] of colors) {
    try {
      const asset = await uploadMedia(admin, name, tinyPng(r, g, b), "GENERAL");
      uploaded.push(asset);
      record("media", "upload", name, `OK → ${asset.url?.slice(0, 40) ?? asset.id}`);
    } catch (e) {
      record("media", "upload", `${name}: ${e.message}`, "FAIL");
    }
  }
  const mediaUrl = uploaded[0]?.url;
  // 2. CMS hero slots with rich Vietnamese content
  const slots = [
    { key: "homepage.hero", payload: {
      eyebrow: "Bệnh viện đa khoa HealthCare",
      title: "Đồng hành cùng sức khỏe gia đình",
      body: "Chọn chuyên khoa, bác sĩ, gói khám hoặc cơ sở và giữ khung giờ phù hợp ngay trên hệ thống.",
      imageUrl: "/media/hospital-team-landscape.jpg",
    } },
    { key: "about.hero", payload: {
      eyebrow: "Câu chuyện HealthCare",
      title: "15 năm đồng hành cùng sức khỏe cộng đồng",
      body: "Từ một phòng khám nhỏ năm 2011, HealthCare đã phát triển thành hệ thống y tế đa chuyên khoa với 3 cơ sở hiện đại phục vụ hơn 200.000 lượt bệnh nhân mỗi năm.",
      ctaLabel: "Tìm hiểu thêm",
      ctaHref: "/about",
      imageUrl: "/media/about-care-poster.jpg",
    } },
    { key: "specialties.hero", payload: {
      eyebrow: "Chuyên khoa",
      title: "8 chuyên khoa mạnh với đội ngũ bác sĩ hàng đầu",
      body: "Tim mạch, thần kinh, tiêu hóa, nhi khoa, sản phụ khoa và nhiều chuyên khoa khác — mỗi chuyên khoa đều có đội ngũ bác sĩ chuyên sâu cùng phác đồ điều trị cập nhật quốc tế.",
      ctaLabel: "Xem tất cả chuyên khoa",
      ctaHref: "/specialties",
      imageUrl: "/media/branches/branch-clinic-hall.jpg",
    } },
    { key: "doctors.hero", payload: {
      eyebrow: "Đội ngũ bác sĩ",
      title: "Gặp gỡ các bác sĩ đồng hành cùng sức khỏe của bạn",
      body: "Mỗi bác sĩ tại HealthCare đều được tuyển chọn khắt khe về chuyên môn và thái độ phục vụ. Xem hồ sơ, kinh nghiệm và đặt lịch trực tiếp với bác sĩ bạn tin tưởng.",
      ctaLabel: "Xem đội ngũ bác sĩ",
      ctaHref: "/doctors",
      imageUrl: "/media/doctor-family-consult.jpg",
    } },
    { key: "services.hero", payload: {
      eyebrow: "Dịch vụ y tế",
      title: "Dịch vụ chẩn đoán và điều trị trọn gói",
      body: "Nội soi không đau, siêu âm 4D, MRI 1.5 Tesla, xét nghiệm toàn diện — công nghệ chẩn đoán hiện đại với chi phí minh bạch, kết quả nhanh trong ngày.",
      ctaLabel: "Xem dịch vụ",
      ctaHref: "/services",
      imageUrl: "/media/branches/branch-clinic-2.jpg",
    } },
    { key: "dat-lich.hero", payload: {
      eyebrow: "Đặt lịch khám",
      title: "Đặt khám trực tuyến — xác nhận ngay qua email",
      body: "Chọn bác sĩ, khung giờ và chi nhánh phù hợp. Hệ thống xác nhận OTP qua email trong vòng 1 phút, nhắc lịch tự động trước 24 giờ.",
      ctaLabel: "Bắt đầu đặt lịch",
      ctaHref: "/dat-lich",
      imageUrl: "/media/branches/branch-reception.jpg",
    } },
  ];
  for (const s of slots) {
    try {
      const current = await get(`/cms/content/${s.key}`, admin).catch(() => null);
      const expectedVersion = current?.version ?? 0;
      await put(`/admin/cms/content/${s.key}`, admin, {
        componentType: "HERO", status: "PUBLISHED",
        payload: s.payload, expectedVersion,
      });
      record("cms", "publish", s.key, "OK");
    } catch (e) {
      record("cms", "publish", `${s.key}: ${e.message}`, "FAIL");
    }
  }
}

// ── Orchestration ───────────────────────────────────────────────────────────

const PHASES = {
  "doctor-users": (admin) => phaseDoctorUsers(admin),
  catalog: (admin) => phaseCatalog(admin),
  doctors: (admin) => phaseDoctors(admin),
  articles: (admin) => phaseArticles(admin),
  "clinical-review": (admin, ctx) => phaseClinicalReview(admin, ctx),
  patients: async () => registerPatients(),
  comments: (admin, ctx) => phaseComments(ctx.patients, ctx.doctors?.["dung.trinh@healthcare.local"] ?? null),
  "health-qa": (admin, ctx) => phaseHealthQA(ctx.patients, ctx.doctors, admin),
  appointments: (admin, ctx) => phaseAppointments(ctx.patients, admin),
  consultations: (admin, ctx) => phaseConsultations(ctx.appointments ?? [], ctx.patients, ctx.doctors),
  "care-plans": (admin, ctx) => phaseCarePlans(ctx.appointments ?? [], ctx.patients, ctx.doctors),
  media: (admin) => phaseMediaAndCms(admin),
};

function listPhases() {
  console.log(Object.keys(PHASES).join("\n"));
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--list")) { listPhases(); return; }
  const onlyIdx = argv.indexOf("--only");
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1].split(",") : null;

  console.log("== HealthCare rich-content seeder ==");
  console.log(`Target: ${API} (BFF) | Mailpit ${MAILPIT}`);
  console.log("⚠ Local Compose stack ONLY — never tunnel a hosted environment");
  console.log("  to localhost:3000 while running this seeder.\n");

  const admin = await login("admin@healthcare.com");
  ok("admin session established");
  const ctx = { patients: {}, doctors: {}, appointments: [] };

  // persona sessions are always established so any phase combination works
  for (const d of NEW_DOCTOR_USERS) {
    try { ctx.doctors[d.email] = await login(d.email); } catch { /* created later */ }
  }
  ctx.doctors["doctor@healthcare.com"] = await login("doctor@healthcare.com").catch(() => null);
  for (const p of PATIENTS) {
    const existsUser = sqlScalar(`select count(*) from users where email='${p.email}'`);
    if (existsUser !== "0") {
      ctx.patients[p.email] = await login(p.email).catch(() => null);
    }
  }
  console.log(`sessions: ${1 + Object.values(ctx.doctors).filter(Boolean).length} admin/doctor`
    + ` + ${Object.values(ctx.patients).filter(Boolean).length} patients`);

  for (const [name, fn] of Object.entries(PHASES)) {
    if (only && !only.includes(name)) continue;
    console.log(`\n▶ ${name}`);
    try {
      await fn(admin, ctx);
    } catch (e) {
      record(name, "PHASE", e.message, "FAIL");
    }
  }

  console.log("\n== Post-seed table counts ==");
  for (const t of ["users", "doctors", "doctor_schedules", "branches", "services", "packages",
    "articles", "article_comments", "health_questions", "health_question_answers",
    "appointments", "patient_consultation_threads", "patient_care_plans", "faqs", "cms_contents",
    "stored_files", "notifications"]) {
    try { console.log(`  ${t}: ${sqlScalar(`select count(*) from ${t}`)}`); }
    catch { console.log(`  ${t}: n/a`); }
  }
  const fails = results.filter((r) => r.status === "FAIL");
  console.log(`\nDone. ${results.length} actions, ${fails.length} failures.`);
  if (fails.length > 0) {
    console.log("Failures:");
    for (const f of fails) console.log(`  - [${f.phase}] ${f.action}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
