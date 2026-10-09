import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(relative) {
  const source = readFileSync(new URL(`../${relative}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)((id) => {
    assert.equal(id, "./lib/cms-page-manifest");
    return load("lib/cms-page-manifest");
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const config = load("next.config").default;
const rules = await config.headers();
function headers(path, preview = false) {
  const result = new Map();
  for (const rule of rules) {
    const matches = rule.source === path || rule.source === "/:path*"
      || (rule.source === "/admin/:path*" && (path === "/admin" || path.startsWith("/admin/")));
    if (!matches || (rule.has && !preview)) continue;
    for (const entry of rule.headers) result.set(entry.key, entry.value);
  }
  return result;
}
const directive = (policy, name) => policy.split("; ").find((item) => item.startsWith(`${name} `)).split(" ").slice(1);

test("every admin entry document allows the native CMS frame after client navigation", () => {
  for (const path of ["/admin", "/admin/users", "/admin/content", "/admin/catalog"]) {
    const values = headers(path);
    assert.ok(directive(values.get("Content-Security-Policy"), "frame-src").includes("'self'"), path);
    assert.deepEqual(directive(values.get("Content-Security-Policy"), "frame-ancestors"), ["'none'"]);
    assert.equal(values.get("X-Frame-Options"), "DENY");
  }
});
test("public and authentication documents do not acquire self-frame permission", () => {
  for (const path of ["/", "/auth/login", "/patient", "/admin-malicious"]) {
    const values = headers(path);
    assert.ok(!directive(values.get("Content-Security-Policy"), "frame-src").includes("'self'"));
    assert.deepEqual(directive(values.get("Content-Security-Policy"), "frame-ancestors"), ["'none'"]);
    assert.equal(values.get("X-Frame-Options"), "DENY");
  }
});
test("only declared public preview documents accept self ancestors", () => {
  assert.equal(headers("/", true).get("X-Frame-Options"), "SAMEORIGIN");
  assert.deepEqual(directive(headers("/", true).get("Content-Security-Policy"), "frame-ancestors"), ["'self'"]);
  for (const path of ["/admin", "/auth/login", "/patient"]) {
    assert.equal(headers(path, true).get("X-Frame-Options"), "DENY");
    assert.deepEqual(directive(headers(path, true).get("Content-Security-Policy"), "frame-ancestors"), ["'none'"]);
  }
});
