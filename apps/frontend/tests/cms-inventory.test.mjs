import assert from "node:assert/strict";
import test from "node:test";
import { CmsClient, parseCmsContent, validateCmsContentInput, isSafeCmsUrl, isSafeCmsImageUrl } from "../lib/cms-client.ts";

const row = (slotKey = "contact.sidebar", ctaHref = "tel:19001234") => ({
  slotKey, componentType: "CTA_BANNER", status: "PUBLISHED", version: 2,
  updatedAt: "2026-10-08T08:00:00Z",
  payload: { title: "Liên hệ", body: "Gọi để được hỗ trợ", ctaLabel: "Gọi ngay", ctaHref },
});
const pageResponse = (rows, page, totalPages, totalCount, pageSize = 2) => Response.json(rows, {
  headers: { "X-Page": String(page), "X-Page-Size": String(pageSize), "X-Total-Pages": String(totalPages), "X-Total-Count": String(totalCount) },
});

for (const family of ["branches", "contact", "packages", "tra-cuu"]) {
  test(`${family} telephone sidebar parses and remains writable`, () => {
    const fixture = row(`${family}.sidebar`, family === "branches" ? "tel:115" : "tel:19001234");
    assert.equal(parseCmsContent(fixture).payload.ctaHref, fixture.payload.ctaHref);
    assert.deepEqual(validateCmsContentInput({ ...fixture, expectedVersion: 2 }, "sidebar"), {});
  });
}

test("telephone support never permits image URLs or unsafe telephone syntax", () => {
  assert.equal(isSafeCmsUrl("tel:19001234"), false, "generic/image read rule stays strict");
  assert.equal(isSafeCmsImageUrl("tel:19001234"), false);
  assert.equal(isSafeCmsUrl("tel:115"), false);
  assert.equal(isSafeCmsImageUrl("tel:115"), false);
  for (const href of ["tel:123", "tel:112", "tel:+115", "tel:115 ", " tel:115", "tel:115\n", "tel:115\t", "tel:%31%31%35", "tel:115;ext=1", "tel:+1234567890123456", "tel:123456;ext=1", "tel:%2b123456", "tel:12 345", "tel:123456\n", "javascript:alert(1)", "//evil.example", "data:text/html,x"]) {
    assert.throws(() => parseCmsContent(row("contact.sidebar", href)), undefined, href);
  }
  assert.throws(() => parseCmsContent({ ...row(), componentType: "IMAGE_CARD", payload: { title: "Ảnh", imageUrl: "tel:19001234" } }));
  assert.throws(() => parseCmsContent({ ...row(), componentType: "IMAGE_CARD", payload: { title: "Ảnh", imageUrl: "tel:115" } }));
  assert.equal(parseCmsContent(row("contact.sidebar", "tel:+842812345678")).payload.ctaHref, "tel:+842812345678");
  for (const href of ["tel:12 3456", "tel:1900 1234", "tel:+84(28)3978-1234"]) {
    assert.equal(parseCmsContent(row("contact.sidebar", href)).payload.ctaHref, href);
    assert.equal(isSafeCmsUrl(href), false);
    assert.equal(isSafeCmsImageUrl(href), false);
  }
});

test("four production telephone classes remain in inventory without schema errors", async () => {
  const rows = [row("branches.sidebar", "tel:115"), row("contact.sidebar"), row("packages.sidebar"), row("tra-cuu.sidebar")];
  const client = new CmsClient({ fetchImpl: async () => pageResponse(rows, 0, 1, 4, 4) });
  const inventory = await client.listAdminInventory();
  assert.deepEqual(inventory.errors, []);
  assert.equal(inventory.content.length, 4);
  assert.equal(inventory.content[0].payload.ctaHref, "tel:115");
});

test("inventory retains valid rows and identifies malformed rows", async () => {
  const client = new CmsClient({ fetchImpl: async () => pageResponse([
    row("contact.sidebar", "/contact"), row("branches.sidebar", "javascript:alert(1)"),
  ], 0, 1, 2) });
  const inventory = await client.listAdminInventory();
  assert.deepEqual(inventory.content.map((item) => item.slotKey), ["contact.sidebar"]);
  assert.equal(inventory.errors.length, 1);
  assert.equal(inventory.errors[0].slotKey, "branches.sidebar");
  assert.equal(inventory.totalCount, 2, "invalid row still counts toward API pagination");
  assert.ok(inventory.errors[0].message.length > 0);
  const legacyInventory = await client.listAdminContent();
  assert.deepEqual(legacyInventory.items.map((item) => item.slotKey), ["contact.sidebar"]);
  assert.deepEqual(legacyInventory.rejectedSlotKeys, ["branches.sidebar"], "legacy inventory cannot silently omit rejected rows");
});

test("inventory follows validated pagination headers and returns every page", async () => {
  const paths = [];
  const client = new CmsClient({ fetchImpl: async (url) => {
    paths.push(url);
    const page = Number(new URL(url, "https://local.test").searchParams.get("page"));
    return pageResponse(page === 0 ? [row("contact.sidebar"), row("branches.sidebar")] : [row("packages.sidebar")], page, 2, 3);
  } });
  const inventory = await client.listAdminInventory();
  assert.equal(inventory.content.length, 3);
  assert.deepEqual(inventory.errors, []);
  assert.equal(inventory.totalCount, 3);
  assert.equal(paths.length, 2);
  assert.equal(new URL(paths[1], "https://local.test").searchParams.get("page"), "1");
});

test("inventory rejects invalid, missing and inconsistent metadata without hiding truncation", async () => {
  for (const headers of [
    {},
    { "X-Page": "0", "X-Total-Pages": "not-a-number", "X-Total-Count": "2" },
    { "X-Page": "0", "X-Total-Pages": "100001", "X-Total-Count": "2" },
    { "X-Page": "1", "X-Total-Pages": "1", "X-Total-Count": "1" },
    { "X-Page": "0", "X-Total-Pages": "1", "X-Total-Count": "2" },
  ]) {
    const client = new CmsClient({ fetchImpl: async () => Response.json([row("contact.sidebar", "/contact")], { headers }) });
    await assert.rejects(client.listAdminInventory(), undefined, JSON.stringify(headers));
  }
});

test("inventory rejects changing totals and duplicate rows across pages", async () => {
  for (const scenario of ["totals", "duplicate"]) {
    const client = new CmsClient({ fetchImpl: async (url) => {
      const page = Number(new URL(url, "https://local.test").searchParams.get("page"));
      return pageResponse([row(page && scenario !== "duplicate" ? "branches.sidebar" : "contact.sidebar", "/contact")], page, 2, page && scenario === "totals" ? 3 : 2, 1);
    } });
    await assert.rejects(client.listAdminInventory(), scenario === "duplicate" ? /trùng lặp/ : /không nhất quán/, scenario);
  }
});
