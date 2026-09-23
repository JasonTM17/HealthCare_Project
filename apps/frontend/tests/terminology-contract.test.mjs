import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Terminology contract (Advisor WS1). The canonical terms live in
// ../../docs/terminology.json at the repository root; this test enforces the
// two mechanical halves of that document across the frontend surfaces:
//
//   1. banned strings must not appear in app/ or components/;
//   2. canonical strings must appear at the specific sites the pass fixed.
//
// Banned matching is case-sensitive on the exact listed forms — those are the
// button/label/CTA shapes the ban is about. Lowercase mid-sentence uses of the
// same words ("Hỏi trợ lý triệu chứng" children overrides, prose on public
// pages) are outside the WS1 safe set and tracked as a follow-up, so they are
// deliberately not swept into an allowlist here.

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
// tests/ -> apps/frontend/ -> apps/ -> repo root; docs/ is a root-level dir.
const readRepo = (relativePath) => readFile(new URL(`../../../docs/${relativePath}`, import.meta.url), "utf8");

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...sourceFiles(rel));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      out.push(rel);
    }
  }
  return out;
}

// Explicit allowlist for banned strings that legitimately remain in files the
// terminology pass does not own. Each entry must name the owner file and the
// reason. Empty for now: every occurrence of the three banned forms was
// rewritten inside the WS1 owned set.
// Shape: { "app/some/page.tsx": "reason (owner: <file purpose>)" }
const BANNED_ALLOWLIST = {};

test("docs/terminology.json declares the canonical terms and banned strings", async () => {
  const terms = JSON.parse(await readRepo("terminology.json"));

  for (const key of ["assistant", "publicAssistantCta", "appointmentEntity", "bookingCta", "dismissal"]) {
    assert.ok(terms.canonical[key]?.term, `canonical term "${key}" is missing`);
  }
  assert.equal(terms.canonical.assistant.term, "Trợ lý AI");
  assert.equal(terms.canonical.publicAssistantCta.term, "Tư vấn triệu chứng");
  assert.equal(terms.canonical.appointmentEntity.term, "Lịch hẹn");
  assert.equal(terms.canonical.bookingCta.term, "Đặt lịch khám");
  assert.equal(terms.canonical.dismissal.term, "Đóng");

  const banned = terms.banned.map((entry) => entry.string);
  for (const expected of ["Chatbot", "Trợ lý triệu chứng", "Đặt lịch hẹn"]) {
    assert.ok(banned.includes(expected), `banned string "${expected}" is missing from terminology.json`);
  }
});

test("banned terminology strings are absent from app/ and components/", async () => {
  const terms = JSON.parse(await readRepo("terminology.json"));
  const files = [...sourceFiles("app"), ...sourceFiles("components")];

  const violations = [];
  for (const file of files) {
    if (BANNED_ALLOWLIST[file]) continue;
    const lines = (await read(file)).split("\n");
    lines.forEach((line, index) => {
      for (const entry of terms.banned) {
        if (line.includes(entry.string)) {
          violations.push(`${file}:${index + 1}: "${entry.string}" (use "${entry.replacedBy}")`);
        }
      }
    });
  }

  assert.deepEqual(violations, [], `Banned terminology found. Fix the copy or add the owning file to BANNED_ALLOWLIST with a reason:\n${violations.join("\n")}`);
});

test("canonical booking CTA appears at the sites the terminology pass fixed", async () => {
  const [footer, home, booking, shell] = await Promise.all([
    read("components/Footer.tsx"),
    read("app/page.tsx"),
    read("app/dat-lich/page.tsx"),
    read("components/PublicPageShell.tsx"),
  ]);

  // Footer mobile care rail, homepage quick card and the /dat-lich branch CTA
  // all read "Đặt lịch khám"; the PublicBookingButton default remains the
  // canonical source for every other booking button.
  assert.match(footer, /mobile-care-rail__primary[\s\S]*?<span>Đặt lịch khám<\/span>/);
  assert.match(home, /<strong>Đặt lịch khám<\/strong>/);
  assert.match(booking, /Đặt lịch khám\r?\n\s*<\/PublicBookingButton>/);
  assert.match(shell, /children = "Đặt lịch khám"/);
});

test("assistant naming follows the canonical terms at the fixed sites", async () => {
  const [shell, login, floating] = await Promise.all([
    read("components/PublicPageShell.tsx"),
    read("app/auth/login/page.tsx"),
    read("components/FloatingHealthAssistant.tsx"),
  ]);

  // PublicAiButton default is the action label, and the login demo badge names
  // the product as "Trợ lý AI" (never "Chatbot").
  assert.match(shell, /PublicAiButton\(\{ children = "Tư vấn triệu chứng"/);
  assert.match(login, /Trợ lý AI/);
  assert.doesNotMatch(login, /Chatbot/);
  // The floating widget's accessible name is deliberately NOT part of the
  // rename: tests/e2e/floating-assistant.spec.ts matches on "Trợ lý sức khỏe".
  assert.match(floating, /Trợ lý sức khỏe/);
});
