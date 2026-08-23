import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../app/admin/", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, appRoot), "utf8");
}

test("admin routes expose the complete operations surface", async () => {
  await Promise.all([
    access(new URL("layout.tsx", appRoot)),
    access(new URL("page.tsx", appRoot)),
    access(new URL("doctors/page.tsx", appRoot)),
    access(new URL("specialties/page.tsx", appRoot)),
    access(new URL("branches/page.tsx", appRoot)),
    access(new URL("services/page.tsx", appRoot)),
    access(new URL("appointments/page.tsx", appRoot)),
    access(new URL("catalog/page.tsx", appRoot)),
    access(new URL("schedules/page.tsx", appRoot)),
    access(new URL("content/page.tsx", appRoot)),
  ]);
});
test("admin layout gates access and exposes real account actions", async () => {
  const layout = await source("layout.tsx");

  assert.match(layout, /healthcare\.auth\.session/);
  assert.match(layout, /ADMIN/);
  assert.match(layout, /unauthenticated/);
  assert.match(layout, /forbidden/);
  assert.match(layout, /aria-current/);
  assert.match(layout, /logoutCurrentUser/);
  assert.match(layout, /\/auth\/login\?next=%2Fadmin/);
  assert.match(layout, /href="#main-content"/);
  assert.match(layout, /id="main-content"/);
  assert.doesNotMatch(layout, /Backend kiểm tra quyền ADMIN|Bản demo local/);
});

test("dashboard uses live catalog snapshots instead of invented metrics", async () => {
  const page = await source("page.tsx");

  assert.match(page, /adminListDoctors/);
  assert.match(page, /adminListSpecialties/);
  assert.match(page, /adminListBranches/);
  assert.match(page, /adminListServices/);
  assert.match(page, /adminListPackages/);
  assert.match(page, /adminListFaqs/);
  assert.match(page, /adminListArticles/);
  assert.match(page, /adminListAppointments/);
  assert.doesNotMatch(page, /fetchDoctors/);
  assert.doesNotMatch(page, /fetchSpecialties/);
  assert.doesNotMatch(page, /fetchBranches/);
  assert.doesNotMatch(page, /endpoint công khai/);
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /Chưa có bản ghi/);
  assert.match(page, /Bản ghi đang quản lý/);
  assert.match(page, /UiIcon/);
  assert.doesNotMatch(page, />500</);
  assert.doesNotMatch(page, />30</);
  assert.doesNotMatch(page, />1000</);
});

test("doctor and specialty screens cover loading, empty, error, and admin mutation states", async () => {
  const [doctors, specialties] = await Promise.all([
    source("doctors/page.tsx"),
    source("specialties/page.tsx"),
  ]);

  for (const page of [doctors, specialties]) {
    assert.match(page, /tone="loading"/);
    assert.match(page, /tone="empty"/);
    assert.match(page, /tone="error"/);
    assert.match(page, /adminCreate/);
    assert.match(page, /adminUpdate/);
    assert.match(page, /adminDelete/);
    assert.match(page, /aria-label/);
    assert.match(page, /window\.confirm/);
    assert.match(page, /role="region"/);
    assert.match(page, /tabIndex=\{0\}/);
    assert.doesNotMatch(page, /ADMIN READ CONTRACT|ADMIN WRITE CONTRACT|Bản demo local|\bActive\b|\bInactive\b/);
  }

  assert.match(doctors, /adminListDoctors/);
  assert.match(specialties, /adminListSpecialties/);
  assert.doesNotMatch(doctors, /fetchDoctors/);
  assert.doesNotMatch(specialties, /fetchSpecialties/);
});

test("branch and service screens expose complete CRUD states without mock content", async () => {
  const [branches, services] = await Promise.all([
    source("branches/page.tsx"),
    source("services/page.tsx"),
  ]);

  assert.match(branches, /adminCreateBranch/);
  assert.match(branches, /adminUpdateBranch/);
  assert.match(branches, /adminDeleteBranch/);
  assert.match(branches, /adminListBranches/);
  assert.match(branches, /window\.confirm/);
  assert.match(branches, /role="region"/);
  assert.match(branches, /tabIndex=\{0\}/);
  assert.doesNotMatch(branches, /fetchBranches/);
  assert.match(services, /adminCreateService/);
  assert.match(services, /adminUpdateService/);
  assert.match(services, /adminDeleteService/);
  assert.match(services, /adminListServices/);
  assert.match(services, /window\.confirm/);
  assert.match(services, /role="region"/);
  assert.match(services, /tabIndex=\{0\}/);
  assert.doesNotMatch(services, /fetchServices/);
  assert.doesNotMatch(branches, /SEED_|mock|fake/i);
  assert.doesNotMatch(services, /SEED_|mock|fake/i);
  assert.doesNotMatch(branches, /ADMIN READ CONTRACT|ADMIN WRITE CONTRACT|Bản demo local|\bActive\b|\bInactive\b/);
  assert.doesNotMatch(services, /ADMIN READ CONTRACT|ADMIN WRITE CONTRACT|Bản demo local|\bActive\b|\bInactive\b/);
});

test("remaining catalog screen preserves inactive records with guarded CRUD actions", async () => {
  const catalog = await source("catalog/page.tsx");

  assert.match(catalog, /adminListPackages/);
  assert.match(catalog, /adminListFaqs/);
  assert.match(catalog, /adminListArticles/);
  assert.match(catalog, /item\.active \?\? true/);
  assert.match(catalog, /item\.active \?\? Boolean\(item\.publishedAt\)/);
  assert.match(catalog, /Đang hiển thị/);
  assert.match(catalog, /Chưa xuất bản/);
  assert.match(catalog, /window\.confirm/);
  assert.match(catalog, /disabled=\{busy\}/);
  assert.match(catalog, /Chưa có gói khám/);
  assert.match(catalog, /Chưa có câu hỏi thường gặp/);
  assert.match(catalog, /Chưa có bài viết/);
  assert.doesNotMatch(catalog, /fetchPackages/);
  assert.doesNotMatch(catalog, /fetchFaqs/);
  assert.doesNotMatch(catalog, /fetchArticles/);
  assert.doesNotMatch(catalog, /SEED_|mock|fake/i);
  assert.doesNotMatch(catalog, /ADMIN READ CONTRACT|ADMIN WRITE CONTRACT|\bInactive\b|\bUnpublished\b/);
});

test("appointment filters apply explicit draft state and keep the table keyboard-scrollable", async () => {
  const appointments = await source("appointments/page.tsx");

  assert.match(appointments, /draftFilters/);
  assert.match(appointments, /appliedFilters/);
  assert.match(appointments, /filtersChanged/);
  assert.match(appointments, /role="region"/);
  assert.match(appointments, /tabIndex=\{0\}/);
  assert.match(appointments, /aria-label="Phân trang lịch hẹn"/);
  assert.match(appointments, /Trạng thái lâm sàng/);
});

test("schedule operations separate load failures from mutation feedback", async () => {
  const schedules = await source("schedules/page.tsx");

  assert.match(schedules, /loadError/);
  assert.match(schedules, /setFeedback/);
  assert.match(schedules, /runMutation/);
  assert.match(schedules, /window\.confirm/);
  assert.match(schedules, /resetScheduleForm/);
  assert.match(schedules, /resetExceptionForm/);
  assert.match(schedules, /exceptionTypeLabels/);
  assert.match(schedules, /Đang mở lịch đặt khám/);
  assert.doesNotMatch(schedules, />SCHEDULING</);
});

test("admin error copy does not expose raw provider messages", async () => {
  const errors = await source("_lib/errors.ts");

  assert.match(errors, /error instanceof ApiError/);
  assert.match(errors, /status === 401/);
  assert.match(errors, /status === 403/);
  assert.match(errors, /status >= 500/);
  assert.doesNotMatch(errors, /description:\s*error\.message/);
});
