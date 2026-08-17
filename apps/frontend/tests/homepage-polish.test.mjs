import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("homepage exposes original clinical navigation and appointment intents", async () => {
  const [page, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/styles.css"),
  ]);

  assert.match(page, /className="hero-search"/);
  assert.match(page, /id="hero-search-input"/);
  assert.match(page, /className="hero-trust"/);
  assert.match(page, /href="#packages"/);
  assert.match(page, /className="ai-navigator-fab"/);
  assert.match(styles, /\.hero-search\s*\{/);
  assert.match(styles, /\.hero-trust\s*\{/);
  assert.match(styles, /\.ai-navigator-fab\s*\{/);
  assert.match(styles, /\.ai-navigator-fab\s*\{[\s\S]*?display: none;/);
  assert.doesNotMatch(page, /Hoan My|Hoàn Mỹ/i);
});
