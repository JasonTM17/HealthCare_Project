import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("operational review pages expose a readable, safe inventory workflow", async () => {
  const [admin, doctor] = await Promise.all([
    read("app/admin/ai-content-reviews/page.tsx"),
    read("app/doctor/ai-content-reviews/page.tsx"),
  ]);

  assert.match(admin, /fetchAdminAiContentReviews/);
  assert.match(admin, /fieldset/);
  assert.match(admin, /Xóa bộ lọc/);
  assert.match(admin, /stateLabel/);
  assert.match(admin, /compactHash/);
  assert.match(admin, /aria-busy=\{loading\}/);
  assert.match(admin, /role="alert"/);
  assert.match(admin, /Tải lại inventory/);
  assert.match(admin, /Không có revision phù hợp/);
  assert.match(admin, /min-h-11/);
  assert.match(admin, /submitAiContentRevision/);
  assert.match(admin, /không tự approve/);
  assert.match(admin, /className="overflow-x-auto" style=\{\{ contain: "layout paint" \}\}/);

  assert.match(doctor, /fetchDoctorAiContentReviews/);
  assert.match(doctor, /fetchDoctorAiContentRevision/);
  assert.match(doctor, /decideDoctorAiContentRevision/);
  assert.match(doctor, /stateLabel/);
  assert.match(doctor, /revisionLoading/);
  assert.match(doctor, /Thay đổi theo từng trường/);
  assert.match(doctor, /Tải lại revision/);
  assert.match(doctor, /REQUEST_CHANGES/);
  assert.match(doctor, /REVOKE/);
  assert.match(doctor, /aria-busy=\{loading\}/);
  assert.match(doctor, /role="status"/);
  assert.match(doctor, /min-h-11/);
});

test("consultation queues keep status and SLA cues safe across responsive states", async () => {
  const [admin, doctor] = await Promise.all([
    read("app/admin/consultations/page.tsx"),
    read("app/doctor/consultations/page.tsx"),
  ]);

  assert.match(admin, /fetchAdminConsultationQueue/);
  assert.match(admin, /adminListDoctors/);
  assert.match(admin, /statusFilter/);
  assert.match(admin, /slaFilter/);
  assert.match(admin, /isDue/);
  assert.match(admin, /statusLabel/);
  assert.match(admin, /METADATA-ONLY/);
  assert.match(admin, /queueError/);
  assert.match(admin, /doctorsError/);
  assert.match(admin, /LoadingState/);
  assert.match(admin, /role="alert"/);
  assert.match(admin, /min-h-11/);
  assert.match(admin, /metadata lần tải trước ở chế độ chỉ đọc/);
  assert.match(admin, /!queueLoading && filteredItems\.length > 0/);
  assert.doesNotMatch(admin, /\{item\.(subject|patientName|attachments|transcript)/);
  assert.doesNotMatch(admin, /item\.threadId\.slice/);

  assert.match(doctor, /statusLabel/);
  assert.match(doctor, /SlaBadge/);
  assert.match(doctor, /isSlaDue/);
  assert.match(doctor, /LoadingState/);
  assert.match(doctor, /ErrorState/);
  assert.match(doctor, /aria-live="polite"/);
  assert.match(doctor, /encodeURIComponent\(item\.id\)/);
  assert.match(doctor, /min-h-11/);
});

test("reviewed resilience keeps clinical inventory safe during stale navigation and outages", async () => {
  const diseaseDetail = await read("app/benh-pho-bien/[slug]/page.tsx");
  const diseaseHub = await read("app/benh-pho-bien/page.tsx");
  const adminReview = await read("app/admin/ai-content-reviews/page.tsx");
  const styles = await read("app/styles.css");

  assert.match(diseaseDetail, /loadedSlugRef/);
  assert.match(diseaseDetail, /value\.slug === slug/);
  assert.match(diseaseHub, /item\.contentKind === "DISEASE_GUIDE"/);
  assert.match(adminReview, /inventory lần tải trước ở chế độ chỉ đọc/);
  assert.match(adminReview, /!loading && items\.length > 0/);
  assert.match(styles, /\.site-shell main#main-content:focus \{[\s\S]*outline: 3px solid var\(--color-amber\)/);
  assert.doesNotMatch(styles, /\.site-shell main#main-content:focus \{\s*outline: none/);
});
