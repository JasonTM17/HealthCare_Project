import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../app/page.tsx", import.meta.url);

test("appointment calls to action target the available branch section", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /id="branches"/);
  assert.match(page, /href="\/#branches"/);
});

test("homepage mounts the published CMS hero slot for realtime updates", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /import \{ CmsLiveSlot \} from "\.\.\/components\/cms"/);
  assert.match(page, /id="cms-live"/);
  assert.match(page, /<CmsLiveSlot className="mt-6" slug="home" slotKey="hero" \/>/);
});
