import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { loadTypeScriptModule } from "./helpers/typescript-module.mjs";

const { createPackageImageUploadScope } = loadTypeScriptModule(new URL("../lib/package-image-upload.ts", import.meta.url));
test("upload blocks synchronously, and prior form callbacks cannot affect a replacement", () => {
  const scope = createPackageImageUploadScope();
  assert.equal(scope.setBusy(0, true), true);
  assert.equal(scope.blocked(), true);
  const next = scope.reset();
  assert.equal(scope.accepts(0), false);
  assert.equal(scope.setBusy(next, true), true);
  assert.equal(scope.setBusy(0, false), false);
  assert.equal(scope.blocked(), true);
  assert.equal(scope.accepts(next), true);
  scope.dispose(); // unmount invalidates its callbacks too
  assert.equal(scope.accepts(next), false);
  scope.activate(); // Strict Mode effect setup restores the current owner
  assert.equal(scope.accepts(next), true);
});

test("actual image component advances custom failure to licensed fallback then readable state", () => {
  const require = createRequire(import.meta.url);
  let phase = 0;
  const source = readFileSync(new URL("../components/PackageImage.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled.outputText)((name) => {
    if (name === "react") return { useState: () => [phase, (update) => { phase = typeof update === "function" ? update(phase) : update; }] };
    if (name === "next/image") return { __esModule: true, default: "img" };
    if (name === "../lib/package-visuals") return loadTypeScriptModule(new URL("../lib/package-visuals.ts", import.meta.url));
    return require(name);
  }, loadedModule, loadedModule.exports);
  const render = () => loadedModule.exports.default({ packageItem: { id: "owned", slug: "tieu-hoa", name: "Gói tiêu hóa", imageUrl: "/missing.jpg" }, className: "image", sizes: "100vw" });
  let view = render();
  assert.equal(view.props.children[0].props.src, "/missing.jpg");
  assert.match(JSON.stringify(view.props.children[1].props.children), /quản trị viên/);
  const staleCustomError = view.props.children[0].props.onError;
  staleCustomError();
  view = render();
  assert.equal(view.props.children[0].props.src, "/images/packages/digestive-health.jpg");
  assert.doesNotMatch(JSON.stringify(view.props.children[1].props.children), /quản trị viên/);
  staleCustomError();
  assert.equal(render().props.children[0].props.src, "/images/packages/digestive-health.jpg");
  view.props.children[0].props.onError();
  view = render();
  assert.equal(view.props.role, "status");
  assert.equal(view.props.children, "Ảnh minh họa chưa tải được");
});
