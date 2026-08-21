import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("public navbar exposes role-aware account entry points", async () => {
  const navbar = await read("components/Navbar.tsx");

  assert.match(navbar, /readAuthSession/);
  assert.match(navbar, /subscribeToAuthSession/);
  assert.match(navbar, /hasRole\(session\.user, "PATIENT"\)/);
  assert.match(navbar, /\/patient\/dashboard/);
  assert.match(navbar, /\/doctor\/dashboard/);
  assert.match(navbar, /\/admin/);
  assert.match(navbar, /\/auth\/login\?next=/);
  assert.match(navbar, /nav-account-link/);
  assert.match(navbar, /mobile-menu__actions[\s\S]*accountDestination\.href/);
});

test("app router has branded loading, error, and not-found states", async () => {
  await Promise.all([
    access(new URL("../app/loading.tsx", import.meta.url)),
    access(new URL("../app/error.tsx", import.meta.url)),
    access(new URL("../app/not-found.tsx", import.meta.url)),
  ]);

  const [loading, error, notFound, styles] = await Promise.all([
    read("app/loading.tsx"),
    read("app/error.tsx"),
    read("app/not-found.tsx"),
    read("app/styles.css"),
  ]);

  assert.match(loading, /PublicPageShell/);
  assert.match(loading, /role="status"/);
  assert.match(loading, /Đang tải dữ liệu bệnh viện/);

  assert.match(error, /"use client"/);
  assert.match(error, /reset/);
  assert.match(error, /role="alert"/);
  assert.match(error, /Đặt lịch khám/);

  assert.match(notFound, /PublicBookingButton/);
  assert.match(notFound, /PublicAiButton/);
  assert.match(notFound, /Không tìm thấy nội dung/);

  assert.match(styles, /route-state__card/);
  assert.match(styles, /nav-account-link/);
});
