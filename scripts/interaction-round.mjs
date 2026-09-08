#!/usr/bin/env node
/**
 * Five-per-role interaction round against the LOCAL HealthCare stack.
 * ⚠ Reruns append duplicate questions/articles — keep this script out of
 *   pristine-seed e2e runs; disposable local Compose environment only.
 *
 * - BFF base: http://localhost:3000/api/v1 (Next.js proxy -> Spring backend)
 * - Every request sends Origin: http://localhost:3000
 * - Login: POST /auth/browser-sessions; __Host- cookies captured manually
 *   from Set-Cookie into a Map (curl cannot store Secure cookies over http).
 * - Unsafe methods send NO X-CSRF-Token (the BFF injects it from the cookie).
 * - Consultation message POSTs send Idempotency-Key: <uuid>.
 * - On 429: clears healthcare:rate-limit:* in Redis via docker, waits 20s, retries.
 *
 * Read-only with respect to repo files; creates runtime data through the real API.
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const BASE = "http://localhost:3000/api/v1";
const ORIGIN = "http://localhost:3000";
const PASSWORD = "HealthCare@2026";
const TODAY = new Date().toISOString().slice(0, 10); // script run date, e.g. 2026-09-07

const SESSION_COOKIE = "__Host-healthcare_session";
const CSRF_COOKIE = "__Host-healthcare_csrf";

// Phase selection for re-runs: PHASES=questions,moderation,answers,articles,reads,consultations,comments
const ALL_PHASES = ["questions", "moderation", "answers", "articles", "reads", "consultations", "comments"];
const PHASES = new Set((process.env.PHASES ?? ALL_PHASES.join(",")).split(",").map((s) => s.trim()).filter(Boolean));
const wantPhase = (name) => PHASES.has(name);
// Which of the two answering doctors act this run (default both).
const ANSWERER_KEYS = (process.env.DOCTOR_ANSWERERS ?? "docKhoi,docHa")
  .split(",").map((s) => s.trim()).filter(Boolean);

const PEOPLE = {
  admin1: "admin@healthcare.com",
  admin2: "admin@healthcare.local",
  docHa: "doctor@healthcare.com", // TS.BS Trần Thu Hà
  docKhoi: "doctor@healthcare.local", // TS.BS Nguyễn Minh Khôi
  dung: "dung.trinh@healthcare.local", // tim mach
  trang: "trang.le@healthcare.local", // san phu khoa
  viet: "viet.phan@healthcare.local", // tieu hoa
  mai: "mai.tran.2603@gmail.com",
  hung: "hung.le.1975@gmail.com",
  ngocanh: "ngocanh.pham.1992@gmail.com",
  quang: "quang.nguyen.1980@gmail.com",
  hong: "hong.vu.1965@gmail.com",
};

const label = Object.fromEntries(Object.entries(PEOPLE).map(([k, v]) => [v, k]));

// ---------------------------------------------------------------- infra ----

function clearRedisRateLimits() {
  try {
    const out = execFileSync(
      "docker",
      ["exec", "infrastructure-redis-1", "redis-cli", "--scan", "--pattern", "healthcare:rate-limit:*"],
      { encoding: "utf8" },
    );
    const keys = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (keys.length > 0) {
      execFileSync(
        "docker",
        ["exec", "infrastructure-redis-1", "redis-cli", "del", ...keys],
        { encoding: "utf8" },
      );
    }
    return keys.length;
  } catch (error) {
    return -1;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// -------------------------------------------------------------- ledger ----

const ledger = new Map(); // email -> { actor, ok: [], fail: [] }
function actorLedger(email) {
  if (!ledger.has(email)) ledger.set(email, { actor: label[email] ?? email, ok: [], fail: [] });
  return ledger.get(email);
}
const BUG_CANDIDATES = []; // { status, actor, method, path, body }

function log(entry) {
  process.stdout.write(entry + "\n");
}

// ------------------------------------------------------------- session ----

class Session {
  constructor(email) {
    this.email = email;
    this.cookies = new Map();
    this.userId = null;
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async login() {
    const res = await fetch(`${BASE}/auth/browser-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ grantType: "PASSWORD", email: this.email, password: PASSWORD }),
    });
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (name === SESSION_COOKIE || name === CSRF_COOKIE) this.cookies.set(name, value);
    }
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      this.userId = body?.user?.id ?? null;
      log(`  [login ${res.status}] ${this.email} (cookies: ${[...this.cookies.keys()].join(", ")})`);
    } else {
      log(`  [login ${res.status}] ${this.email} body=${JSON.stringify(body).slice(0, 160)}`);
    }
    actorLedger(this.email); // ensure ledger entry exists
    if (!res.ok) {
      actorLedger(this.email).fail.push({ action: "LOGIN", path: "/auth/browser-sessions", status: res.status });
      BUG_CANDIDATES.push({ status: res.status, actor: this.email, method: "POST", path: "/auth/browser-sessions", body: JSON.stringify(body).slice(0, 300) });
    }
    return res.ok;
  }

  /**
   * Authenticated call through the BFF. Retries 429 up to 3 times:
   * clears Redis rate limits, waits 20 seconds between attempts.
   */
  async call(method, path, payload, { idempotencyKey } = {}) {
    const headers = { Origin: ORIGIN, Accept: "application/json" };
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    if (this.cookies.size > 0) headers["Cookie"] = this.cookieHeader();
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    let attempt = 0;
    for (;;) {
      attempt += 1;
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      if (res.status === 429 && attempt <= 3) {
        const cleared = clearRedisRateLimits();
        log(`  [429] ${this.email} ${method} ${path} -> cleared ${cleared} redis keys, retry ${attempt}/3 in 20s`);
        await sleep(20_000);
        continue;
      }
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      return { status: res.status, ok: res.ok, body };
    }
  }

  /** Call + log + ledger bookkeeping. */
  async act(action, method, path, payload, opts = {}) {
    const result = await this.call(method, path, payload, opts);
    const line = result.ok
      ? `  [${result.status}] ${this.email} ${method} ${path}`
      : `  [${result.status}] ${this.email} ${method} ${path} :: ${JSON.stringify(result.body).slice(0, 220)}`;
    log(line);
    const bucket = result.ok ? actorLedger(this.email).ok : actorLedger(this.email).fail;
    bucket.push({ action, method, path, status: result.status });
    if (!result.ok) {
      BUG_CANDIDATES.push({ status: result.status, actor: this.email, method, path, body: JSON.stringify(result.body).slice(0, 300) });
    }
    await sleep(250); // be gentle with rate limiters
    return result;
  }
}

// --------------------------------------------------------------- main -----

const OUT = {
  questions: [], // {patient, id}
  answers: [], // {questionId, answerer, approver}
  articles: [], // {doctor, slug, status}
  reads: [], // {doctor, queue, appointments, profile}
  admin2: { moderations: 0, cmsList: null, cmsHero: null, doctorsList: null },
  threads: [], // {patient, doctor, threadId, patientMsgs, doctorMsgs}
  comments: [], // {patient, slug, status}
};

const PATIENT_QUESTIONS = {
  mai: {
    topicSlug: "tim-mach",
    question: "Tôi thường thấy hồi hộp và tim đập nhanh khi leo cầu thang, đôi khi phải nghỉ mới tiếp tục được. Tôi nên đi khám tim mạch sớm hay chỉ cần theo dõi thêm tại nhà?",
    publicAlias: "Mai An Tam",
  },
  hung: {
    topicSlug: "co-xuong-khop",
    question: "Bố tôi gần bảy mươi tuổi, gần đây thường đau lưng xuống vùng hông và đi lại khó khăn vào buổi sáng. Nên khám cột sống hay xương khớp trước và cần chuẩn bị gì?",
    publicAlias: "Ong Hung Khoi Khoe",
  },
  ngocanh: {
    topicSlug: "san-phu-khoa",
    question: "Chu kỳ kinh nguyệt của tôi mấy tháng nay không đều, vòng lần trước kéo dài hơn bốn mươi ngày. Tôi có nên đi khám phụ khoa để siêu âm và xét nghiệm nội tiết không?",
    publicAlias: "Ngoc Anh",
  },
  quang: {
    topicSlug: "tieu-hoa",
    question: "Sau bữa ăn tối tôi thường bị đầy bụng và ợ chua, nhất là khi ăn cay. Triệu chứng này có đáng lo và tôi nên nội soi dạ dày sớm đến mức nào?",
    publicAlias: "Quang Tim Hieu",
  },
  hong: {
    topicSlug: "tai-mui-hong",
    question: "Tôi bị nghẹt mũi kéo dài kèm giảm khứu giác sau khi cảm cúm, đã hơn hai tuần chưa hết. Có phải dấu hiệu viêm xoang và nên khám tai mũi họng ngay không?",
    publicAlias: "Ba Hong",
  },
};

const COMMENTS = {
  mai: "Bài viết rất dễ hiểu, phần theo dõi huyết áp tại nhà giúp gia đình tôi nhiều. Cảm ơn bác sĩ.",
  hung: "Tôi sẽ áp dụng bài tập trong mục phòng ngừa đột quỵ, mong bác sĩ viết thêm về chế độ ăn cho người cao tuổi.",
  ngocanh: "Thông tin về viêm loét dạ dày rất rõ ràng, tôi sẽ đem danh sách dấu hiệu cảnh báo này đi khám.",
  quang: "Mục thoái hóa cột sống thắt lưng viết sát với tình trạng của tôi, đã ghi lại các tư thế cần tránh.",
  hong: "Cảm ơn bài hướng dẫn tự đo huyết áp, các bước rất cụ thể và dễ làm theo cho người lớn tuổi.",
};

const ARTICLE_SEEDS = {
  dung: {
    title: "Hướng dẫn phục hồi tim mạch sau xuất viện cho người cao tuổi",
    slug: `hd-tim-mach-phuc-hoi-sau-xuat-vien-dung-${Date.now()}`,
    summary: "Lộ trình vận động và theo dõi an toàn cho bệnh nhân tim mạch trong bốn tuần đầu sau xuất viện.",
    body: "Bốn tuần đầu sau xuất viện là giai đoạn quan trọng để phục hồi chức năng tim mạch. Bệnh nhân nên bắt đầu đi bộ nhẹ trong nhà, tăng dần thời lượng theo hướng dẫn của bác sĩ, theo dõi mạch và huyết áp mỗi sáng, và quay lại khám đúng hẹn. Dấu hiệu cần báo ngay cho cơ sở y tế gồm đau tức ngực, khó thở bất thường, hoặc phù chi dưới tăng.",
  },
  trang: {
    title: "Nhận biết sớm dấu hiệu bất thường ở chu kỳ kinh nguyệt",
    slug: `hd-phu-khoa-chu-ky-kinh-bat-thuong-trang-${Date.now()}`,
    summary: "Khi nào rối loạn kinh nguyệt cần khám phụ khoa và quá trình thăm dò thường gồm những bước nào.",
    body: "Rối loạn kinh nguyệt kéo dài trên ba chu kỳ nên được thăm dò bằng siêu âm và xét nghiệm nội tiết khi bác sĩ chỉ định. Bệnh nhân nên ghi lại nhật ký chu kỳ, thời điểm ra máu nhiều và triệu chứng kèm theo để buổi khám hiệu quả hơn. Không tự dùng thuốc nội tiết nếu chưa có chỉ định chuyên khoa.",
  },
  viet: {
    title: "Ợ chua và đầy bụng sau ăn: khi nào nên nội soi dạ dày",
    slug: `hd-tieu-hoa-uoa-chua-noi-soi-viet-${Date.now()}`,
    summary: "Phân biệt triệu chứng tiêu hóa thông thường với dấu hiệu cần nội soi sớm theo khuyến cáo chuyên khoa tiêu hóa.",
    body: "Ợ chua và đầy bụng sau ăn thường liên quan đến thói quen ăn uống, nhưng nếu kéo dài trên hai tuần, kèm sụt cân, nôn, hoặc đi ngoài đen, người bệnh cần được nội soi dạ dày sớm. Nên ăn chậm, hạn chế rượu bia và thuốc giảm đau không kê đơn, và khám tiêu hóa khi triệu chứng tái đi tái lại.",
  },
};

async function main() {
  log(`=== HealthCare five-per-role interaction round @ ${new Date().toISOString()} ===`);
  const cleared = clearRedisRateLimits();
  log(`pre-flight: cleared ${cleared} redis rate-limit keys`);

  const S = {};
  for (const [key, email] of Object.entries(PEOPLE)) {
    S[key] = new Session(email);
  }

  // ---- Phase 0: login everyone
  log("\n--- Phase 0: logins");
  for (const s of Object.values(S)) {
    await s.login();
    await sleep(200);
  }

  // ---- Phase 1: 5 patients each ask 1 health question
  log("\n--- Phase 1: patients ask health questions");
  if (wantPhase("questions")) {
    for (const [key, q] of Object.entries(PATIENT_QUESTIONS)) {
      const res = await S[key].act("ask-question", "POST", "/patient/health-questions", q);
      if (res.ok && res.body?.id) {
        OUT.questions.push({ patient: key, id: res.body.id, status: res.body.status });
      }
    }
  } else {
    log("  skipped (PHASES)");
  }

  // ---- Phase 2: ADMIN #2 acts (moderation + CMS reads + admin list)
  log("\n--- Phase 2: admin#2 (admin@healthcare.local)");
  if (wantPhase("moderation")) {
    for (const q of OUT.questions) {
      const res = await S.admin2.act("moderate-approve", "PUT", `/admin/health-questions/${q.id}/moderation`, { decision: "APPROVE" });
      if (res.ok) OUT.admin2.moderations += 1;
    }
  } else {
    log("  moderation skipped (PHASES)");
  }
  const cmsList = await S.admin2.act("cms-list", "GET", "/admin/cms/content");
  if (cmsList.ok) OUT.admin2.cmsList = Array.isArray(cmsList.body) ? cmsList.body.length : Object.keys(cmsList.body ?? {}).length;
  const cmsHero = await S.admin2.act("cms-hero", "GET", "/admin/cms/content/homepage.hero");
  OUT.admin2.cmsHero = cmsHero.status;
  const docsList = await S.admin2.act("admin-doctors-list", "GET", "/admin/doctors?size=5");
  if (docsList.ok) OUT.admin2.doctorsList = docsList.body?.content?.length ?? docsList.body?.totalElements ?? null;

  // ---- Phase 3: doctor answers + cross-approval
  log("\n--- Phase 3: answering doctors answer 2 questions each");
  if (wantPhase("answers")) {
    const answerers = [
      { key: "docKhoi", email: PEOPLE.docKhoi },
      { key: "docHa", email: PEOPLE.docHa },
    ].filter((a) => ANSWERER_KEYS.includes(a.key));
    const approvers = [S.dung, S.trang, S.viet];
    let approverIdx = 0;
    const ANSWER_TEXT = "Câu hỏi của bạn rất thiết thực. Dựa trên mô tả triệu chứng, bạn nên đặt lịch khám chuyên khoa để được thăm dò đúng hướng; trong thời gian chờ, hãy ghi lại tần suất và mức độ triệu chứng, duy trì sinh hoạt điều độ và không tự dùng thuốc đặc trị. Nếu triệu chứng tăng nhanh, kèm sốt, đau dữ dội hoặc khó thở, cần đến cơ sở y tế ngay.";
    for (const a of answerers) {
      const queue = await S[a.key].act("queue-read", "GET", "/doctor/health-questions");
      const awaiting = Array.isArray(queue.body) ? queue.body.filter((q) => q.status === "AWAITING_DOCTOR") : [];
      log(`  queue for ${a.email}: ${awaiting.length} AWAITING_DOCTOR`);
      for (let i = 0; i < 2; i += 1) {
        const q = awaiting[i];
        if (!q) { log(`  !! ${a.email} has no AWAITING_DOCTOR question left for slot ${i}`); continue; }
        const ans = await S[a.key].act("answer", "PUT", `/doctor/health-questions/${q.id}/answer`, { answer: ANSWER_TEXT });
        if (ans.ok) {
          const approver = approvers[approverIdx % approvers.length];
          approverIdx += 1;
          const dec = await approver.act(`approve-answer(${a.key})`, "PUT", `/doctor/health-questions/${q.id}/decision`, { decision: "APPROVE" });
          OUT.answers.push({ questionId: q.id, answerer: a.key, approver: approver.email, answerStatus: ans.status, decisionStatus: dec.status });
        }
      }
    }
  } else {
    log("  answers skipped (PHASES)");
  }

  // ---- Phase 3b: three doctors post one DISEASE_GUIDE article each
  log("\n--- Phase 3b: dung/trang/viet each post one DISEASE_GUIDE article");
  if (wantPhase("articles")) {
    for (const [key, article] of Object.entries(ARTICLE_SEEDS)) {
      const res = await S[key].act("post-article", "POST", "/doctor/articles", {
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        body: article.body,
        contentKind: "DISEASE_GUIDE",
        active: true,
      });
      OUT.articles.push({ doctor: key, slug: article.slug, status: res.status, ok: res.ok });
    }
  } else {
    log("  skipped (PHASES)");
  }

  // ---- Phase 3c: all five doctors read queue + schedule + profile
  log("\n--- Phase 3c: all five doctors read their queue/schedule/profile");
  if (wantPhase("reads")) {
    for (const [key, email] of [["docHa", PEOPLE.docHa], ["docKhoi", PEOPLE.docKhoi], ["dung", PEOPLE.dung], ["trang", PEOPLE.trang], ["viet", PEOPLE.viet]]) {
      const queue = await S[key].act("queue-read", "GET", "/doctor/health-questions");
      const appts = await S[key].act("schedule-read", "GET", `/doctor/appointments?date=${TODAY}`);
      const profile = await S[key].act("profile-read", "GET", "/doctor/profile");
      OUT.reads.push({
        doctor: email,
        queue: queue.status,
        queueCount: Array.isArray(queue.body) ? queue.body.length : null,
        appointments: appts.status,
        profile: profile.status,
      });
    }
  } else {
    log("  skipped (PHASES)");
  }

  // ---- Phase 4: consultations (mai -> dung, hong -> trang)
  log("\n--- Phase 4: consultation threads + 2 patient + 2 doctor messages");
  if (wantPhase("consultations")) {
    const consultCases = [
      { patient: "mai", doctor: "dung" },
      { patient: "hong", doctor: "trang" },
    ];
    for (const c of consultCases) {
      const appts = await S[c.patient].act("patient-appts-read", "GET", "/patient/appointments?size=20");
      const items = appts.body?.content ?? [];
      const target = items.find((x) => x.status === "CONFIRMED");
      if (!target) { log(`  !! ${PEOPLE[c.patient]} has no CONFIRMED appointment; skipping thread`); continue; }
      log(`  ${PEOPLE[c.patient]} appointment ${target.id} with ${target.doctorName} (${target.appointmentDate})`);
      // Idempotency: reuse an existing thread for this appointment when present.
      const existing = await S[c.patient].call("GET", "/patient/consultations");
      const prior = (Array.isArray(existing.body) ? existing.body : []).find((t) => t.appointmentId === target.id);
      let threadId = prior?.id ?? null;
      if (prior) {
        log(`  reusing existing thread ${threadId} for appointment ${target.id}`);
      } else {
        const created = await S[c.patient].act("create-thread", "POST", "/patient/consultations", {
          appointmentId: target.id,
          subject: `Tư vấn sau lịch hẹn ${target.bookingCode ?? ""}`.trim(),
          consentAccepted: true,
          consentVersion: "consultation-v1",
        });
        if (!created.ok || !created.body?.id) continue;
        threadId = created.body.id;
      }
      let patientMsgs = 0;
      let doctorMsgs = 0;
      for (const body of [
        "Chào bác sĩ, tôi muốn hỏi thêm về kết quả buổi khám hôm đó và chế độ sinh hoạt cần lưu ý ạ.",
        "Cảm ơn bác sĩ đã giải thích. Tôi sẽ ghi lại chỉ số theo dõi hàng ngày và gửi bác sĩ xem trước buổi tái khám.",
      ]) {
        const sent = await S[c.patient].act("patient-msg", "POST", `/patient/consultations/${threadId}/messages`, { body }, { idempotencyKey: randomUUID() });
        if (sent.ok) patientMsgs += 1;
      }
      for (const body of [
        "Chào bạn, tôi đã xem lại thông tin. Bạn hãy duy trì lịch theo dõi như hẹn và liên hệ ngay nếu có triệu chứng bất thường.",
        "Tốt rồi. Trước buổi tái khám bạn nhớ mang theo kết quả cận lâm sàng cũ và danh sách thuốc đang dùng.",
      ]) {
        const sent = await S[c.doctor].act("doctor-msg", "POST", `/doctor/consultations/${threadId}/messages`, { body }, { idempotencyKey: randomUUID() });
        if (sent.ok) doctorMsgs += 1;
      }
      OUT.threads.push({ patient: c.patient, doctor: PEOPLE[c.doctor], threadId, patientMsgs, doctorMsgs });
    }
  } else {
    log("  skipped (PHASES)");
  }

  // ---- Phase 5: each patient comments on one published article
  log("\n--- Phase 5: patient article comments");
  if (wantPhase("comments")) {
    const arts = await S.mai.call("GET", "/hospital/articles?size=10");
    const slugs = (arts.body?.content ?? []).map((a) => a.slug);
    log(`  published articles: ${slugs.length}`);
    const patientKeys = ["mai", "hung", "ngocanh", "quang", "hong"];
    for (let i = 0; i < patientKeys.length; i += 1) {
      const key = patientKeys[i];
      const slug = slugs[i % Math.max(slugs.length, 1)];
      if (!slug) { log(`  !! no published article available for comment`); continue; }
      const res = await S[key].act("post-comment", "POST", `/hospital/articles/${slug}/comments`, { content: COMMENTS[key] });
      OUT.comments.push({ patient: key, slug, status: res.status, ok: res.ok });
    }
  } else {
    log("  skipped (PHASES)");
  }

  // ---- Final summary
  log("\n=== SUMMARY TABLE ===");
  log("actor | role | actions-ok | actions-fail");
  for (const [, entry] of ledger) {
    log(`${entry.actor} | ${entry.ok.length} ok | ${entry.fail.length} fail`);
  }
  log("\nDoctor QA matrix:");
  for (const a of OUT.answers) {
    log(`  question ${a.questionId} answered by ${a.answerer} (HTTP ${a.answerStatus}), approved by ${a.approver} (HTTP ${a.decisionStatus})`);
  }
  log("\nDoctor reads:");
  for (const r of OUT.reads) {
    log(`  ${r.doctor}: queue=${r.queue}(${r.queueCount}) appointments=${r.appointments} profile=${r.profile}`);
  }
  log("\nArticles:");
  for (const a of OUT.articles) log(`  ${a.doctor}: ${a.slug} -> ${a.status}`);
  log("\nThreads:");
  for (const t of OUT.threads) log(`  ${t.patient}<->${t.doctor} thread=${t.threadId} patientMsgs=${t.patientMsgs} doctorMsgs=${t.doctorMsgs}`);
  log("\nComments:");
  for (const c of OUT.comments) log(`  ${c.patient}: ${c.slug} -> ${c.status}`);
  log("\nAdmin#2:");
  log(`  moderations=${OUT.admin2.moderations} cmsList=${OUT.admin2.cmsList} cmsHero=${OUT.admin2.cmsHero} doctorsList=${OUT.admin2.doctorsList}`);
  log("\nQuestions created:");
  for (const q of OUT.questions) log(`  ${q.patient}: ${q.id} (${q.status})`);

  if (BUG_CANDIDATES.length > 0) {
    log(`\n=== BUG CANDIDATES (non-2xx responses) : ${BUG_CANDIDATES.length} ===`);
    for (const b of BUG_CANDIDATES) {
      log(`  [${b.status}] ${b.actor} ${b.method} ${b.path}\n    ${b.body}`);
    }
  } else {
    log("\n=== NO non-2xx responses recorded ===");
  }
}

main().catch((error) => {
  console.error("FATAL", error);
  process.exitCode = 1;
});
