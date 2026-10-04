import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("cms inline editor is admin-only, client-only and rides the existing admin PUT", async () => {
  const [editor, liveSlot, store, layout] = await Promise.all([
    read("components/cms/CmsInlineEditor.tsx"),
    read("components/cms/CmsLiveSlot.tsx"),
    read("lib/cms-edit-mode.ts"),
    read("app/layout.tsx"),
  ]);

  // Admin gate: the toolbar and the per-slot affordance both require an
  // ADMIN session; guests and patients never see any edit surface.
  assert.match(editor, /hasRole\(session\.user, "ADMIN"\)/);
  assert.match(liveSlot, /hasRole\(session\.user, "ADMIN"\)/);
  // The save path is the existing admin upsert (server-enforced role,
  // optimistic version, history + rollback) — never a new public write API.
  assert.match(editor, /client\.upsertContent\(slotKey, input\)/);
  // Validation and schema lookups use the page-local slot alias ("hero"),
  // not the backend slot key ("about.hero") which is only an API address.
  assert.match(editor, /validateCmsContentInput\(input, typeLookupKey\)/);
  assert.match(editor, /cmsComponentTypesForSlot\(typeLookupKey\)/);
  assert.match(editor, /const typeLookupKey = slotAlias \?\? \(slotKey as CmsSlotKey\)/);
  // Images reuse the governed media upload field, not raw URL-only input.
  assert.match(editor, /CmsImageField/);
  // Edit mode is a per-tab UI preference in sessionStorage, hydrated from an
  // effect — never written during module init or server render.
  assert.match(store, /sessionStorage/);
  assert.doesNotMatch(store, /localStorage/);
  assert.match(store, /export function hydrateCmsEditMode/);
  // Client-only mount: the layout mounts the toolbar next to the assistant;
  // no public route file gains route-segment config from this feature.
  assert.match(layout, /CmsEditModeToolbar/);
});

test("cms edit mode never appears for signed-out visitors on public slots", async () => {
  const [liveSlot, store] = await Promise.all([
    read("components/cms/CmsLiveSlot.tsx"),
    read("lib/cms-edit-mode.ts"),
  ]);
  // The affordance element exists only when canInlineEdit is true, which
  // requires the post-mount gate (hydration must stay byte-identical to the
  // server HTML), the toolbar switch, and an ADMIN session.
  assert.match(liveSlot, /const canInlineEdit = mounted && editModeOn && Boolean\(session && hasRole\(session\.user, "ADMIN"\)\)/);
  // Mount gate rides the external client-mounted store (no synchronous setState in effects).
  assert.match(liveSlot, /subscribeClientMounted/);
  assert.match(liveSlot, /markClientMounted/);
  assert.match(store, /markClientMounted/);
  assert.match(liveSlot, /data-testid="cms-inline-edit-open"/);
  // Editing targets the resolved backend slot key, not the page-local alias.
  assert.match(liveSlot, /slotKey=\{backendSlotKey\}/);
});

test("public route files keep their rendering contract untouched", async () => {
  // The overlay must not flip public pages to dynamic rendering: no route
  // segment config may appear in the files this feature touches.
  const appDir = new URL("../app/", import.meta.url);
  const touched = ["layout.tsx", "about/page.tsx", "page.tsx", "careers/page.tsx"];
  for (const file of touched) {
    const source = await readFile(new URL(file, appDir), "utf8");
    assert.doesNotMatch(source, /force-dynamic|revalidate = 0/, `${file} must stay cacheable`);
  }
});
