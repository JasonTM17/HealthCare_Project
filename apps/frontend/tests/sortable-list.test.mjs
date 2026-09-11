import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("useSortableList hook is properly structured with touch resilience and DOM rollback", async () => {
  const hook = await read("lib/useSortableList.ts");

  assert.match(hook, /"use client"/);
  assert.match(hook, /import Sortable from "sortablejs"/);
  assert.match(hook, /export function useSortableList/);

  // Single-item or empty guard
  assert.match(hook, /const isDragDisabled = disabled \|\| \(items\?\.length \?\? 0\) <= 1;/);

  // Touch resilience options
  assert.match(hook, /delayOnTouchOnly:\s*true/);
  assert.match(hook, /touchStartThreshold:\s*3/);
  assert.match(hook, /fallbackTolerance:\s*3/);
  assert.match(hook, /swapThreshold:\s*0\.65/);

  // DOM rollback wrapped in try-catch
  assert.match(hook, /try\s*\{[\s\S]*?evt\.from\.insertBefore[\s\S]*?\}\s*catch\s*\(domErr\)/);
  assert.match(hook, /onReorderRef\.current\(currentItems,\s*oldIndex,\s*newIndex\)/);
});

test("CSS styles provide visual feedback and touch guards for drag handles", async () => {
  const styles = await read("app/styles.css");

  assert.match(styles, /\.sortable-ghost\s*\{[\s\S]*?opacity:\s*0\.45/);
  assert.match(styles, /\.sortable-chosen\s*\{/);
  assert.match(styles, /\.sortable-drag\s*\{[\s\S]*?cursor:\s*grabbing/);

  assert.match(
    styles,
    /\.section-drag-handle,\s*\.faq-drag-handle,\s*\.package-drag-handle\s*\{[\s\S]*?touch-action:\s*none\s*!important/
  );
  assert.match(
    styles,
    /\.section-drag-handle,\s*\.faq-drag-handle,\s*\.package-drag-handle\s*\{[\s\S]*?user-select:\s*none\s*!important/
  );
});

test("admin catalog page wires sortable handles with accessible touch targets", async () => {
  const catalog = await read("app/admin/catalog/page.tsx");

  assert.match(catalog, /useSortableList<ArticleSectionForm>/);
  assert.match(catalog, /useSortableList<Faq>/);
  assert.match(catalog, /useSortableList<HealthPackage>/);

  // All 3 drag handles have min-h-11 min-w-11 accessible touch target
  assert.match(catalog, /section-drag-handle[\s\S]*?min-h-11\s+min-w-11/);
  assert.match(catalog, /faq-drag-handle[\s\S]*?min-h-11\s+min-w-11/);
  assert.match(catalog, /package-drag-handle[\s\S]*?min-h-11\s+min-w-11/);
});
