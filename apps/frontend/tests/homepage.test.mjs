import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../app/page.tsx", import.meta.url);

test("appointment and contact calls to action target an available section", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /id="contact"/);
  assert.match(page, /href="#contact"/);
});
