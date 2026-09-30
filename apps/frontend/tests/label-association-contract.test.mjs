import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Source-scan contract (same style as tests/booking-otp-email.test.mjs):
// every raw <input>/<textarea>/<select> in the audited forms must be
// programmatically associated with a label, otherwise a screen reader says
// "edit text, blank" on the audit-critical fields (AI credit grant reason)
// and the clinical-safety field (patient allergy warning that doctors read
// when prescribing).
//
// Accepted association, per the codebase's own good shape:
//   1. aria-label on the control, or
//   2. id on the control + htmlFor on a <label> in the same file, or
//   3. the control wrapped inside a <label> element (khuôn ở admin/catalog).
//
// Parsing is quote- and brace-aware: JSX attributes like
// onChange={(event) => setX(event.target.value)} embed ">" characters, so a
// naive /<input[^>]*>/ would cut the tag open mid-expression.
const grantPath = new URL("../app/admin/ai-credits/page.tsx", import.meta.url);
const dashPath = new URL("../app/patient/dashboard/page.tsx", import.meta.url);

function readTag(source, tagStart) {
  let i = tagStart + 1;
  let braceDepth = 0;
  let quote = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "{") {
      braceDepth += 1;
    } else if (ch === "}") {
      braceDepth -= 1;
    } else if (ch === ">" && braceDepth === 0) {
      return { tagText: source.slice(tagStart, i + 1), end: i + 1 };
    }
    i += 1;
  }
  throw new Error(`Unterminated tag starting at offset ${tagStart}`);
}

function attrValue(tagText, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|\\{\\s*([^{}]*?)\\s*\\})`, "i").exec(tagText);
  if (!match) return null;
  return match[1] ?? match[2];
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function collectLabelInfo(source) {
  const ranges = [];
  const htmlForValues = new Set();
  const stack = [];
  const re = /(<label(?=[\s/>]))|(<\/label(?=[\s>]))/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    if (m[1]) {
      const { tagText, end } = readTag(source, m.index);
      const htmlFor = attrValue(tagText, "htmlFor");
      if (htmlFor !== null) htmlForValues.add(htmlFor);
      if (!tagText.trimEnd().endsWith("/>")) stack.push(m.index);
      re.lastIndex = end - 1;
    } else {
      const start = stack.pop();
      if (start !== undefined) ranges.push([start, m.index + "</label>".length]);
    }
  }
  return { ranges, htmlForValues };
}

function findOrphanControls(label, source) {
  const orphans = [];
  const re = /<(input|textarea|select)(?=[\s/>])/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const { tagText, end } = readTag(source, m.index);
    re.lastIndex = end - 1;
    if (/\saria-label(?=[\s=])/.test(tagText)) continue;
    const id = attrValue(tagText, "id");
    if (id !== null && label.htmlForValues.has(id)) continue;
    const wrapped = label.ranges.some(([start, stop]) => m.index >= start && m.index < stop);
    if (wrapped) continue;
    orphans.push(`${label.name}:${lineOf(source, m.index)} <${m[1]}> ${tagText.slice(0, 90)}…`);
  }
  return orphans;
}

test("every form control in admin/ai-credits page.tsx has a programmatic label", async () => {
  const source = await readFile(grantPath, "utf8");
  const orphans = findOrphanControls({ name: "app/admin/ai-credits/page.tsx", ...collectLabelInfo(source) }, source);
  assert.deepEqual(orphans, [], `orphan controls without id+htmlFor, aria-label, or wrapping <label>:\n${orphans.join("\n")}`);
});

test("every form control in patient/dashboard page.tsx has a programmatic label", async () => {
  const source = await readFile(dashPath, "utf8");
  const orphans = findOrphanControls({ name: "app/patient/dashboard/page.tsx", ...collectLabelInfo(source) }, source);
  assert.deepEqual(orphans, [], `orphan controls without id+htmlFor, aria-label, or wrapping <label>:\n${orphans.join("\n")}`);
});

test("the two audit-critical grant controls and the allergy textarea are label-paired by id", async () => {
  const grant = await readFile(grantPath, "utf8");
  const dash = await readFile(dashPath, "utf8");
  // Custom credit amount input + sibling label (grant evidence amount).
  assert.match(grant, /<label[^>]*htmlFor="grant-amount"[^>]*>[\s\S]*?Số lượng credit cộng thêm[\s\S]*?<input[^>]*id="grant-amount"/);
  // Reason note input + sibling label (audit-trail evidence).
  assert.match(grant, /<label[^>]*htmlFor="grant-reason"[^>]*>[\s\S]*?Lý do \/ Ghi chú[\s\S]*?<input[^>]*id="grant-reason"/);
  // Allergy warning textarea that doctors read when prescribing.
  assert.match(dash, /<label[^>]*htmlFor="allergy-warning"[^>]*>[\s\S]*?Cảnh báo dị ứng[\s\S]*?<textarea[^>]*id="allergy-warning"/);
});
