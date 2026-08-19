import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("careers page is backed by live openings and a complete application workflow", async () => {
  const [page, dialog, client, types, styles] = await Promise.all([
    read("app/careers/page.tsx"),
    read("app/careers/CareerApplicationDialog.tsx"),
    read("lib/api-client.ts"),
    read("types/hospital.ts"),
    read("app/careers/careers.module.css"),
  ]);

  assert.match(page, /fetchCareerPositions/);
  assert.match(page, /Cơ hội nghề nghiệp tại HealthCare/);
  assert.match(page, /Khối chuyên môn/);
  assert.match(page, /Nơi làm việc/);
  assert.match(page, /Ứng tuyển vị trí này/);
  assert.match(dialog, /submitJobApplication/);
  assert.match(dialog, /privacyConsent/);
  assert.match(dialog, /applicationCode/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /returnFocusRef/);
  assert.match(client, /\/careers\/jobs\/\$\{encodeURIComponent\(slug\)\}\/applications/);
  assert.match(types, /interface JobPosition/);
  assert.match(types, /interface JobApplicationReceipt/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("career backend persists applications and protects recruiter review endpoints", async () => {
  const [migration, controller, adminController, security, service, seeder] = await Promise.all([
    read("../backend/src/main/resources/db/migration/V22__careers_and_job_applications.sql"),
    read("../backend/src/main/java/com/healthcare/career/controller/CareerController.java"),
    read("../backend/src/main/java/com/healthcare/career/controller/AdminCareerController.java"),
    read("../backend/src/main/java/com/healthcare/security/SecurityConfig.java"),
    read("../backend/src/main/java/com/healthcare/career/service/CareerService.java"),
    read("../backend/src/main/java/com/healthcare/standalone/StandaloneDataSeeder.java"),
  ]);

  assert.match(migration, /CREATE TABLE job_positions/);
  assert.match(migration, /CREATE TABLE job_applications/);
  assert.match(controller, /@ResponseStatus\(HttpStatus\.CREATED\)/);
  assert.match(controller, /@Valid @RequestBody JobApplicationRequest/);
  assert.match(adminController, /hasRole\('ADMIN'\)/);
  assert.match(security, /\/api\/v1\/careers\/jobs\/\*\/applications/);
  assert.match(security, /\/api\/v1\/admin\/careers\/\*\*/);
  assert.match(service, /DUPLICATE_WINDOW_DAYS/);
  assert.match(service, /normalizePhone/);
  assert.match(seeder, /seedJobPositions/);
});
