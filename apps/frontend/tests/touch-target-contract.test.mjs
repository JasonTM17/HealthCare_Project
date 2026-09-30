import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

// WCAG 2.5.5: operational surfaces (doctor article moderation, admin report
// review) must use the repo-standard 2.75rem control height (min-h-11), and
// icon-only affordances (edit/delete/close) must be at least a 2.75rem square.
const TOUCH_TARGET_SURFACES = [
  "app/doctor/articles/page.tsx",
  "app/admin/health-questions/page.tsx",
  "app/benh-pho-bien/page.tsx",
  "app/admin/ai-content-reviews/page.tsx",
];

// Quote- and brace-aware JSX scanner: returns every <button ...>...</button>
// element as { line, openTag, inner }. Attribute expressions such as
// onClick={() => ...} contain ">" characters, so a naive regex cannot tell
// where an opening tag ends; this walker skips quoted strings and tracks
// brace depth so the tag only ends at a top-level ">".
function scanButtons(source) {
  const buttons = [];
  let cursor = 0;
  while (true) {
    const start = source.indexOf("<button", cursor);
    if (start === -1) break;
    let quote = null;
    let braces = 0;
    let tagEnd = -1;
    for (let i = start + 7; i < source.length; i += 1) {
      const ch = source[i];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        continue;
      }
      if (ch === "{") {
        braces += 1;
        continue;
      }
      if (ch === "}") {
        braces -= 1;
        continue;
      }
      if (ch === ">" && braces === 0) {
        tagEnd = i;
        break;
      }
    }
    if (tagEnd === -1) break;
    const openTag = source.slice(start, tagEnd + 1);
    const selfClosing = source[tagEnd - 1] === "/";
    let inner = "";
    let next = tagEnd + 1;
    if (!selfClosing) {
      const bodyStart = next;
      let depth = 1;
      let i = bodyStart;
      while (i < source.length) {
        if (source.startsWith("<button", i)) {
          depth += 1;
          i += 7;
          continue;
        }
        if (source.startsWith("</button>", i)) {
          depth -= 1;
          if (depth === 0) break;
          i += 9;
          continue;
        }
        i += 1;
      }
      inner = source.slice(bodyStart, i);
      next = i + "</button>".length;
    }
    buttons.push({ line: source.slice(0, start).split(/\r?\n/).length, openTag, inner });
    cursor = next;
  }
  return buttons;
}

const isIconOnlyButton = (inner) => {
  if (!/\bUiIcon\b/.test(inner)) return false;
  const withoutIcons = inner.replace(/<UiIcon\b[^>]*\/>/g, "");
  const visibleText = withoutIcons
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\s+/g, "");
  return visibleText.length === 0;
};

test("touch-target contract: no button class carries a sub-2.75rem min-h-10 control height", async () => {
  for (const path of TOUCH_TARGET_SURFACES) {
    const source = await read(path);
    for (const button of scanButtons(source)) {
      assert.doesNotMatch(
        button.openTag,
        /\bmin-h-10\b/,
        `${path}:${button.line} button class still uses min-h-10 (40px) below the repo's 2.75rem standard`,
      );
    }
  }
});

test("touch-target contract: icon-only buttons meet the min-h-11 tap square", async () => {
  for (const path of TOUCH_TARGET_SURFACES) {
    const source = await read(path);
    for (const button of scanButtons(source)) {
      if (!isIconOnlyButton(button.inner)) continue;
      assert.match(
        button.openTag,
        /\bmin-h-11\b/,
        `${path}:${button.line} icon-only button lacks the min-h-11 touch-target height`,
      );
    }
  }
});
