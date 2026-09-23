import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Same loading strategy as booking-slot-lifecycle.test.mjs: compile the real
// lib/*.ts with the project's typescript package and evaluate it. Node's ESM
// resolver cannot load lib/datetime.ts directly because the bundler-style
// extensionless "./business-time" import resolves fine in Next but not in bare
// node ESM, so both parent and TZ-shifted child run the transpiled CJS.
const requireFromTest = createRequire(import.meta.url);
const ts = requireFromTest("typescript");

const libDir = fileURLToPath(new URL("../lib/", import.meta.url));
const businessTimeSource = readFileSync(resolve(libDir, "business-time.ts"), "utf8");
const datetimeSource = readFileSync(resolve(libDir, "datetime.ts"), "utf8");

const BUSINESS_TIME_CJS = ts.transpileModule(businessTimeSource, {
  compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: resolve(libDir, "business-time.ts"),
}).outputText;
const DATETIME_CJS = ts.transpileModule(datetimeSource, {
  compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: resolve(libDir, "datetime.ts"),
}).outputText;

function evaluateCompiled(businessTimeCjs, datetimeCjs) {
  const businessTime = { exports: {} };
  new Function("exports", "require", "module", businessTimeCjs)(
    businessTime.exports,
    (specifier) => {
      throw new Error(`unexpected require in business-time: ${specifier}`);
    },
    businessTime,
  );
  const datetime = { exports: {} };
  new Function("exports", "require", "module", datetimeCjs)(
    datetime.exports,
    (specifier) => {
      if (specifier === "./business-time") return businessTime.exports;
      throw new Error(`unexpected require in datetime: ${specifier}`);
    },
    datetime,
  );
  return datetime.exports;
}

// 2026-01-02T03:04:05Z is 10:04 on 2 January 2026 in Asia/Ho_Chi_Minh (UTC+7)
// and 22:04 on 1 January in America/New_York, so host-zone drift is visible.
const INSTANT = "2026-01-02T03:04:05Z";
const BUSINESS_ZONE = "Asia/Ho_Chi_Minh";

function renderInProcess(timeZone) {
  if (timeZone) process.env.TZ = timeZone;
  const { formatDate, formatDateTime } = evaluateCompiled(BUSINESS_TIME_CJS, DATETIME_CJS);
  return {
    date: formatDate(INSTANT),
    dateTime: formatDateTime(INSTANT),
    // Deliberately NOT time-zone pinned: proves the host zone really moved.
    unpinned: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(INSTANT)),
  };
}

// Git Bash on Windows strips a leading `TZ=…` assignment from the child
// environment, and a parent-side process.env.TZ set after node startup is not
// guaranteed to reach the child's ICU defaults, so the child is given both:
// TZ in the spawn env AND an explicit process.env.TZ assignment in-script.
function renderInChild(timeZone) {
  const script = `
    process.env.TZ = ${JSON.stringify(timeZone)};
    const businessTime = { exports: {} };
    new Function("exports", "require", "module", ${JSON.stringify(BUSINESS_TIME_CJS)})(
      businessTime.exports, () => { throw new Error("unexpected require"); }, businessTime);
    const datetime = { exports: {} };
    new Function("exports", "require", "module", ${JSON.stringify(DATETIME_CJS)})(
      datetime.exports,
      (s) => { if (s === "./business-time") return businessTime.exports; throw new Error("unexpected " + s); },
      datetime);
    const { formatDate, formatDateTime } = datetime.exports;
    const stdout = require("node:process").stdout;
    stdout.write(JSON.stringify({
      date: formatDate(${JSON.stringify(INSTANT)}),
      dateTime: formatDateTime(${JSON.stringify(INSTANT)}),
      unpinned: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(${JSON.stringify(INSTANT)})),
      hostZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));
  `;
  const result = spawnSync(process.execPath, ["-e", script], {
    encoding: "utf8",
    env: { ...process.env, TZ: timeZone },
  });
  assert.equal(result.status, 0, `child node failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

test("formatDate and formatDateTime render the Asia/Ho_Chi_Minh wall clock", () => {
  const baseline = renderInProcess(null);
  const expectedDate = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: BUSINESS_ZONE }).format(new Date(INSTANT));
  const expectedDateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_ZONE }).format(new Date(INSTANT));
  assert.equal(baseline.date, expectedDate);
  assert.equal(baseline.dateTime, expectedDateTime);
  // 10:04 ICT — not 03:04 UTC and not the previous day.
  assert.match(baseline.dateTime, /10:04/);
  assert.match(baseline.dateTime, /2026/);
});

test("rendering is identical regardless of host time zone", () => {
  const baseline = renderInProcess(null);
  let shifted = null;
  let shiftedZone = null;
  for (const zone of ["America/New_York", "Asia/Tokyo", "Pacific/Kiritimati", "Europe/Lisbon"]) {
    const candidate = renderInChild(zone);
    if (candidate.unpinned !== baseline.unpinned) {
      shifted = candidate;
      shiftedZone = zone;
      break;
    }
  }
  assert.ok(
    shifted,
    "no candidate zone moved the host rendering — the equality below would be vacuous; investigate this platform",
  );
  assert.equal(shifted.date, baseline.date, `date drifted under TZ=${shiftedZone}`);
  assert.equal(shifted.dateTime, baseline.dateTime, `date-time drifted under TZ=${shiftedZone}`);
});

test("nullish and unparseable inputs degrade gracefully", () => {
  const { formatDate, formatDateTime } = evaluateCompiled(BUSINESS_TIME_CJS, DATETIME_CJS);
  for (const missing of [null, undefined, ""]) {
    assert.equal(formatDate(missing), "Chưa có ngày");
    assert.equal(formatDateTime(missing), "Chưa có ngày");
  }
  // Unparseable strings pass through verbatim, matching lib/business-time.
  assert.equal(formatDate("Chưa rõ"), "Chưa rõ");
  assert.equal(formatDateTime("Chưa rõ"), "Chưa rõ");
});

test("lib/datetime delegates formatting and never re-implements it", () => {
  assert.match(datetimeSource, /from "\.\/business-time"/);
  assert.doesNotMatch(datetimeSource, /Intl\.DateTimeFormat|toLocaleString|toLocaleDateString|timeZone:/);
});
