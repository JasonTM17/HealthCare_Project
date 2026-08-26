import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/patient/dashboard/page.tsx", import.meta.url);
const stylesPath = new URL("../app/patient/dashboard/CareHub.module.css", import.meta.url);

test("patient care hub derives every task from patient-scoped contracts", async () => {
  const source = await readFile(dashboardPath, "utf8");

  assert.match(source, /Việc cần làm hôm nay/);
  assert.match(source, /findUpcomingAppointment/);
  assert.match(source, /ACTIVE_APPOINTMENT_STATUSES/);
  assert.match(source, /paymentStatus === "PENDING_VERIFICATION"/);
  assert.match(source, /Chờ thu ngân đối soát/);
  assert.match(source, /fetchPatientCarePlans/);
  assert.match(source, /fallbackOpenCarePlanCount/);
  assert.match(source, /loadOrReuse\(retrySnapshot\?\.overview, \(\) => fetchPatientOverview\(\)\)/);
  assert.match(source, /loadOrReuse\(retrySnapshot\?\.carePlans, \(\) => fetchPatientCarePlans\(\)\)/);
  assert.match(source, /setCarePlans\(toLoadable\(carePlansResult\)\)/);
  assert.doesNotMatch(source, /overviewResult\.value\.openCarePlanTaskCount === 0/);
  assert.match(source, /href="\/dat-lich"/);
  assert.match(source, /isOverdueCarePlanItem/);
  assert.match(source, /unreadConsultationCount/);
  assert.match(source, /overviewHasNewDiagnosticResult/);
  assert.match(source, /overviewHasNewPrescription/);
  assert.match(source, /newDiagnosticResult/);
  assert.match(source, /newPrescription/);
  assert.match(source, /paymentAppointmentId=\$\{encodeURIComponent\(firstPendingVerification\.bookingCode\)\}/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
});

test("patient care hub keeps loading, healthy, empty, partial-error and retry semantics visible", async () => {
  const source = await readFile(dashboardPath, "utf8");

  assert.match(source, /aria-busy=\{isLoading\}/);
  assert.match(source, /CareHubSkeleton/);
  assert.match(source, /Bạn đang theo dõi đúng tiến độ/);
  assert.match(source, /Chưa có việc chăm sóc được ghi nhận/);
  assert.match(source, /Một phần thông tin chưa tải được/);
  assert.match(source, /Chỉ phần chưa tải sẽ được thử lại; dữ liệu đã tải vẫn được giữ trên màn hình/);
  assert.match(source, /Thử tải lại phần thiếu/);
  assert.match(source, /Chưa thể tải trung tâm chăm sóc/);
  assert.match(source, /function prepareRetry/);
  assert.match(source, /function loadOrReuse/);
  assert.match(source, /retrySnapshotRef\.current = session \? \{/);
  assert.match(source, /setOverview\(\(current\) => prepareRetry\(current\)\)/);
  assert.match(source, /setCarePlans\(\(current\) => prepareRetry\(current\)\)/);
  assert.doesNotMatch(source, /setOverview\(initialOverview\)/);
  assert.doesNotMatch(source, /setCarePlans\(initialCarePlans\)/);
  assert.match(source, /role="alert"/);
  assert.match(source, /role="status"/);
});

test("patient care hub styling is token-based, touch-safe and responsive", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1\.35fr\)/);
  assert.match(styles, /@media \(max-width:\s*980px\)/);
  assert.match(styles, /@media \(max-width:\s*640px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /var\(--color-teal-800\)/);
  assert.match(styles, /var\(--color-mint\)/);
  assert.match(styles, /var\(--color-amber-dark\)/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}/i);
  assert.doesNotMatch(styles, /transition:\s*all/);
});
