import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const profilePagePath = new URL("../app/patient/profile/page.tsx", import.meta.url);
const portalChromePath = new URL("../components/PortalChrome.tsx", import.meta.url);
const navbarPath = new URL("../components/Navbar.tsx", import.meta.url);

// Stale-name regression: the header and every other chrome surface read the
// session snapshot (users.display_name). After a profile rename the backend
// syncs that column, but the client snapshot still needs a forced rehydrate —
// otherwise the header keeps the old name until the next full reload.
test("saving the patient profile force-refreshes the auth session", async () => {
  const page = await readFile(profilePagePath, "utf8");

  assert.match(page, /hydrateAuthSession/);
  const saveCall = page.indexOf("await updatePatientProfile(");
  const refresh = page.indexOf("hydrateAuthSession(true)", saveCall);
  assert.ok(saveCall > -1, "profile page must call updatePatientProfile");
  assert.ok(refresh > saveCall, "hydrateAuthSession(true) must run after the profile save resolves");
  assert.ok(refresh - saveCall < 1200, "session refresh must live inside the same save handler");
});

test("portal chrome and navbar render the session display name as the single identity source", async () => {
  const [portalChrome, navbar] = await Promise.all([
    readFile(portalChromePath, "utf8"),
    readFile(navbarPath, "utf8"),
  ]);

  assert.match(portalChrome, /<strong>\{user\.displayName\}<\/strong>/);
  assert.match(portalChrome, /user\.displayName/);
  assert.match(navbar, /authSession\.user\.displayName/);
});
