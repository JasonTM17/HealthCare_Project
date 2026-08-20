import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../app/admin/", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, appRoot), "utf8");
}

test("admin routes expose the bounded CMS surface", async () => {
  await Promise.all([
    access(new URL("layout.tsx", appRoot)),
    access(new URL("page.tsx", appRoot)),
    access(new URL("doctors/page.tsx", appRoot)),
    access(new URL("specialties/page.tsx", appRoot)),
    access(new URL("branches/page.tsx", appRoot)),
    access(new URL("services/page.tsx", appRoot)),
  ]);
});
test("admin layout gates the UI by the ADMIN role and keeps the demo boundary visible", async () => {
  const layout = await source("layout.tsx");

  assert.match(layout, /healthcare\.auth\.session/);
  assert.match(layout, /ADMIN/);
  assert.match(layout, /unauthenticated/);
  assert.match(layout, /forbidden/);
  assert.match(layout, /aria-current/);
  assert.match(layout, /Backend kiểm tra quyền ADMIN/);
});

test("dashboard uses live catalog snapshots instead of invented metrics", async () => {
  const page = await source("page.tsx");

  assert.match(page, /fetchDoctors/);
  assert.match(page, /fetchSpecialties/);
  assert.match(page, /fetchBranches/);
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /Chưa có bản ghi active/);
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
    assert.match(page, /ADMIN READ CONTRACT/);
    assert.match(page, /ADMIN WRITE CONTRACT/);
    assert.match(page, /adminCreate/);
    assert.match(page, /adminUpdate/);
    assert.match(page, /adminDelete/);
    assert.match(page, /aria-label/);
  }

  assert.match(doctors, /adminListDoctors/);
  assert.match(specialties, /adminListSpecialties/);
  assert.doesNotMatch(doctors, /fetchDoctors/);
  assert.doesNotMatch(specialties, /fetchSpecialties/);
});

test("branch and service screens expose typed read/write contracts without mock content", async () => {
  const [branches, services] = await Promise.all([
    source("branches/page.tsx"),
    source("services/page.tsx"),
  ]);

  assert.match(branches, /adminCreateBranch/);
  assert.match(branches, /adminUpdateBranch/);
  assert.match(branches, /adminDeleteBranch/);
  assert.match(branches, /adminListBranches/);
  assert.match(branches, /ADMIN READ CONTRACT/);
  assert.doesNotMatch(branches, /fetchBranches/);
  assert.match(services, /adminCreateService/);
  assert.match(services, /adminUpdateService/);
  assert.match(services, /adminDeleteService/);
  assert.match(services, /adminListServices/);
  assert.match(services, /ADMIN READ CONTRACT/);
  assert.doesNotMatch(services, /fetchServices/);
  assert.doesNotMatch(branches, /SEED_|mock|fake/i);
  assert.doesNotMatch(services, /SEED_|mock|fake/i);
});
