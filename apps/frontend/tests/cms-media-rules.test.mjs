import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

async function loadCmsClientModule() {
  const source = await read("lib/cms-client.ts");
  const directory = await mkdtemp(join(tmpdir(), "healthcare-cms-client-"));
  const file = join(directory, "cms-client-runtime.ts");
  await writeFile(file, source, "utf8");
  try {
    return await import(`${pathToFileURL(file).href}?${Date.now()}`);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

const bffPath = new URL("../lib/server/healthcare-bff.ts", import.meta.url);
const runtimeConfig = Object.freeze({
  backendOrigin: "https://backend.internal",
  serviceToken: "synthetic-bff-service-token-at-least-32-bytes",
  requestTimeoutMs: 1_000,
});

async function loadBff(env = {}) {
  const source = await readFile(bffPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "healthcare-bff.ts",
    reportDiagnostics: true,
  });
  const errors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "BFF helper must transpile without diagnostics");

  const compiledModule = { exports: {} };
  const context = vm.createContext({
    AbortController,
    ArrayBuffer,
    clearTimeout,
    console,
    fetch,
    Headers,
    module: compiledModule,
    process: { env: { ...env } },
    Request,
    ReadableStream,
    Response,
    setTimeout,
    URL,
  });
  const load = new vm.Script(
    `(function (exports, require, module) {${transpiled.outputText}\n})`,
    { filename: "healthcare-bff.compiled.cjs" },
  ).runInContext(context);
  load(compiledModule.exports, (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "node:buffer") return { Buffer };
    if (specifier === "node:crypto") return { randomUUID };
    if (specifier === "node:net") return { isIP };
    throw new Error(`Unexpected runtime import: ${specifier}`);
  }, compiledModule);
  return compiledModule.exports;
}

function browserRequest(path, init = {}) {
  return new Request(`https://beta.healthcare.test${path}`, init);
}

const MEDIA_ID = "123e4567-e89b-12d3-a456-426614174000";

test("client imageUrl rule mirrors the backend CSP allowlist at the write boundary", async () => {
  const { isSafeCmsImageUrl, validateCmsContentInput } = await loadCmsClientModule();

  // PASS: root-relative media and the three CSP img-src HTTPS hosts.
  assert.equal(isSafeCmsImageUrl("/media/x.jpg"), true);
  assert.equal(isSafeCmsImageUrl("/media/branches/branch-hospital.jpg"), true);
  assert.equal(isSafeCmsImageUrl("https://images.unsplash.com/a.jpg"), true);
  assert.equal(isSafeCmsImageUrl("https://images.pexels.com/photos/1.jpeg"), true);
  assert.equal(isSafeCmsImageUrl("https://img.vietqr.io/image.png"), true);

  // REJECT: any other HTTPS host — it would silently break under img-src CSP.
  assert.equal(isSafeCmsImageUrl("https://evil.example/a.jpg"), false);
  assert.equal(isSafeCmsImageUrl("https://images.unsplash.com.evil.example/a.jpg"), false);
  // REJECT: scheme-relative, downgrade, and active-content URLs.
  assert.equal(isSafeCmsImageUrl("//evil.example/a.jpg"), false);
  assert.equal(isSafeCmsImageUrl("http://images.unsplash.com/a.jpg"), false);
  assert.equal(isSafeCmsImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeCmsImageUrl("data:image/png;base64,AAAA"), false);
  assert.equal(isSafeCmsImageUrl("https://user:secret@images.unsplash.com/a.jpg"), false);

  const input = (imageUrl) => ({
    componentType: "IMAGE_CARD",
    payload: { title: "Thẻ ảnh", imageUrl },
    status: "PUBLISHED",
    expectedVersion: 0,
  });
  assert.deepEqual(validateCmsContentInput(input("/media/x.jpg"), "sidebar"), {});
  assert.deepEqual(
    validateCmsContentInput(input("https://images.unsplash.com/a.jpg"), "sidebar"),
    {},
  );
  for (const bad of ["https://evil.example/a.jpg", "//evil.example/a.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA"]) {
    const errors = validateCmsContentInput(input(bad), "sidebar");
    assert.ok(Object.keys(errors).length > 0, `${bad} must surface a field error before save`);
  }
});

test("read/render path stays lenient for already-published image hosts", async () => {
  const { parseCmsContent } = await loadCmsClientModule();

  // A slot published before the allowlist still parses and renders: the
  // write boundary rejects new saves, never the public read.
  const legacy = parseCmsContent({
    slotKey: "homepage.sidebar",
    componentType: "IMAGE_CARD",
    payload: { title: "Thẻ cũ", imageUrl: "https://legacy.example/old.jpg" },
    status: "PUBLISHED",
    version: 4,
    updatedAt: "2026-08-21T00:00:00Z",
  });
  assert.equal(legacy.payload.imageUrl, "https://legacy.example/old.jpg");
});

test("client keeps the broader HTTPS link rule for ctaHref and href", async () => {
  const { validateCmsContentInput } = await loadCmsClientModule();

  // External CTAs are legitimate: only image fields carry the host allowlist.
  const banner = validateCmsContentInput({
    componentType: "CTA_BANNER",
    payload: {
      title: "Đặt lịch",
      body: "Nội dung",
      ctaLabel: "Đặt ngay",
      ctaHref: "https://external-booking.example/dat-lich",
    },
    status: "PUBLISHED",
    expectedVersion: 0,
  }, "body");
  assert.deepEqual(banner, {});

  const card = validateCmsContentInput({
    componentType: "IMAGE_CARD",
    payload: {
      title: "Thẻ ảnh",
      imageUrl: "/media/x.jpg",
      href: "https://any-host.example/chi-tiet",
    },
    status: "PUBLISHED",
    expectedVersion: 0,
  }, "sidebar");
  assert.deepEqual(card, {});
});

test("BFF forwards the backend Cache-Control on public media reads only", async () => {
  const bff = await loadBff();
  const upstreamMedia = () => new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": 'inline; filename="x.jpg"',
      "Content-Type": "image/jpeg",
    },
  });

  const mediaResponse = await bff.proxyHealthcareRequest(
    browserRequest(`/api/v1/media/${MEDIA_ID}`),
    ["media", MEDIA_ID],
    { fetchImpl: upstreamMedia, runtimeConfig },
  );
  assert.equal(mediaResponse.status, 200);
  assert.equal(
    mediaResponse.headers.get("cache-control"),
    "public, max-age=3600",
    "media bytes must keep the backend TTL instead of no-store",
  );

  // Without an upstream Cache-Control the posture stays fail-closed.
  const noCacheUpstream = await bff.proxyHealthcareRequest(
    browserRequest(`/api/v1/media/${MEDIA_ID}`),
    ["media", MEDIA_ID],
    { fetchImpl: async () => new Response(new Uint8Array([4]), { status: 200 }), runtimeConfig },
  );
  assert.equal(noCacheUpstream.headers.get("cache-control"), "no-store");

  // The upload mutation is unchanged: still proxied, still no-store.
  const uploadResponse = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/media/upload", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=x",
        Origin: "https://beta.healthcare.test",
      },
      body: "fake-multipart-body",
    }),
    ["media", "upload"],
    { fetchImpl: async () => Response.json({ id: MEDIA_ID }), runtimeConfig },
  );
  assert.equal(uploadResponse.status, 200);
  assert.equal(uploadResponse.headers.get("cache-control"), "no-store");

  // The catalog read contract is untouched.
  const catalogResponse = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/hospital/doctors?page=0"),
    ["hospital", "doctors"],
    { fetchImpl: async () => Response.json({ content: [] }), runtimeConfig },
  );
  assert.equal(
    catalogResponse.headers.get("cache-control"),
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  );

  // And every other API path still defaults to no-store.
  const otherResponse = await bff.proxyHealthcareRequest(
    browserRequest("/api/v1/health"),
    ["health"],
    { fetchImpl: async () => Response.json({ status: "UP" }), runtimeConfig },
  );
  assert.equal(otherResponse.headers.get("cache-control"), "no-store");
});

test("CMS image surfaces carry the matching fallback and advisory contracts", async () => {
  const [renderer, imageField, styles] = await Promise.all([
    read("components/cms/CmsRenderer.tsx"),
    read("components/cms/CmsImageField.tsx"),
    read("app/styles.css"),
  ]);

  // IMAGE_CARD SafeImage: a valid-but-broken src swaps to a static note via
  // the hidden attribute — no hooks, no new client boundary.
  assert.match(renderer, /onError=\{\(event\) => \{/);
  assert.match(renderer, /event\.currentTarget\.hidden = true;/);
  assert.match(renderer, /nextElementSibling\?\.removeAttribute\("hidden"\)/);
  assert.match(renderer, /<p className="text-sm text-red-700" hidden role="alert">Hình ảnh chưa được hiển thị\.<\/p>/);
  assert.doesNotMatch(renderer, /useState|useEffect|"use client"/);

  // The editor-side advisory mirrors the same CSP-aligned rule and copy.
  assert.match(imageField, /isSafeCmsImageUrl/);
  assert.match(imageField, /Unsplash, Pexels, VietQR/);

  // Plain-text CMS bodies keep admin-authored line breaks: the base
  // .cms-renderer__body rule must carry white-space: pre-line.
  const bodyRule = styles.match(/^\.cms-renderer__body\s*\{[^}]*\}/m);
  assert.ok(bodyRule, "missing .cms-renderer__body rule");
  assert.match(bodyRule[0], /white-space:\s*pre-line/);
});
