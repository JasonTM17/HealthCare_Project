import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);
const portalGatePath = new URL("../components/PortalAccessGate.tsx", import.meta.url);
const adminLayoutPath = new URL("../app/admin/layout.tsx", import.meta.url);

test("indeterminate browser-session authority privacy-blocks portal and admin content with recovery actions", async () => {
  const [apiClient, portalGate, adminLayout] = await Promise.all([
    readFile(apiClientPath, "utf8"),
    readFile(portalGatePath, "utf8"),
    readFile(adminLayoutPath, "utf8"),
  ]);

  assert.match(apiClient, /AuthHydrationStatus = [^;]*"indeterminate"/);
  assert.match(apiClient, /BROWSER_SESSION_AUTHORITY_INDETERMINATE/);
  assert.match(apiClient, /error instanceof ApiError && error\.status === 401/);

  assert.match(portalGate, /hydrationStatus === "indeterminate"/);
  assert.match(portalGate, /Không thể xác định trạng thái phiên đăng nhập/);
  assert.match(portalGate, /hydrateAuthSession\(true\)/);
  assert.match(portalGate, /window\.location\.reload\(\)/);
  assert.ok(
    portalGate.indexOf('hydrationStatus === "indeterminate"') < portalGate.indexOf("return children"),
    "portal children must be unreachable while authority is indeterminate",
  );

  assert.match(adminLayout, /hydrationStatus === "indeterminate"/);
  assert.match(adminLayout, /Không thể xác định trạng thái phiên đăng nhập/);
  assert.match(adminLayout, /hydrateAuthSession\(true\)/);
  assert.match(adminLayout, /window\.location\.reload\(\)/);
  assert.ok(
    adminLayout.indexOf('hydrationStatus === "indeterminate"') < adminLayout.indexOf("return <AdminShell"),
    "admin children must be unreachable while authority is indeterminate",
  );
});
