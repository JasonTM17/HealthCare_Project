import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../components/ui/ToastNotification.tsx", import.meta.url), "utf8");

test("toast semantics reserve alerts for errors", () => {
  assert.match(source, /aria-live=\{tone === "error" \? "assertive" : "polite"\}/);
  assert.match(source, /role=\{tone === "error" \? "alert" : "status"\}/);
});

test("toast can be paused by pointer and keyboard focus", () => {
  assert.match(source, /const paused = hovered \|\| focused/);
  assert.match(source, /onMouseEnter=\{\(\) => setHovered\(true\)\}/);
  assert.match(source, /onMouseLeave=\{\(\) => setHovered\(false\)\}/);
  assert.match(source, /onFocusCapture=\{\(\) => setFocused\(true\)\}/);
  assert.match(source, /animationPlayState: paused \? "paused" : "running"/);
});

test("toast close target and motion preferences are accessible", () => {
  assert.match(source, /min-h-11 min-w-11/);
  assert.match(source, /motion-reduce:transition-none motion-reduce:animate-none/);
});
