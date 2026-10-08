import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/patient/dashboard/page.tsx", import.meta.url);
const profilePagePath = new URL("../app/patient/profile/page.tsx", import.meta.url);
const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);

// New-account regression: a verified patient account can exist before any
// patient_profiles row (Google sign-in, phone-less registration). The profile
// endpoint answers 403, which means "not created yet" — the dashboard must
// render a setup state instead of the generic partial-failure banner.
test("dashboard maps a 403 profile response to an empty setup state, not an error", async () => {
  const dashboard = await readFile(dashboardPath, "utf8");

  const profileAssign = dashboard.indexOf("setProfile(");
  assert.ok(
    dashboard.indexOf('getErrorStatus(profileResult.reason) === 403', profileAssign) > -1,
    "profileResult 403 must be intercepted before it becomes a Loadable error",
  );
  assert.match(dashboard, /\{ status: "success", data: null \}/);
  assert.match(dashboard, /data === null \? \(/, "setup state must be reachable from null data");
  assert.match(dashboard, /Tạo hồ sơ ngay/, "setup card must offer a creation path");
});

test("StateContent hands a null payload to its child instead of dereferencing it", async () => {
  const dashboard = await readFile(dashboardPath, "utf8");

  assert.match(
    dashboard,
    /if \(state\.data === null\) return children\(state\.data\);/,
    "null must bypass the .empty/.content array checks",
  );
});

test("profile page enters setup mode on 403 and sends the phone on first save", async () => {
  const page = await readFile(profilePagePath, "utf8");

  assert.match(page, /setProfileMissing\(true\)/);
  assert.ok(
    page.indexOf("err.status === 403") > -1,
    "a 403 profile read must switch the page into setup mode",
  );
  const savePayload = page.indexOf("await updatePatientProfile(");
  const phoneField = page.indexOf("phone:", savePayload);
  assert.ok(phoneField > savePayload && phoneField - savePayload < 900,
    "first save must send the contact phone so the backend can provision the profile");
  assert.match(page, /profileMissing \? phone\.trim\(\) : undefined/);
});

test("the update-profile payload carries an optional phone for provisioning", async () => {
  const client = await readFile(apiClientPath, "utf8");

  const payload = client.indexOf("interface UpdatePatientProfilePayload");
  assert.ok(payload > -1);
  assert.ok(
    client.indexOf("phone?:", payload) > -1,
    "UpdatePatientProfilePayload must accept an optional phone field",
  );
});
