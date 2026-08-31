import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("branch maps derive trusted Google Maps URLs only from backend-owned branch data", async () => {
  const map = await read("components/BranchMap.tsx");

  assert.match(map, /branchName\?\.trim\(\)/);
  assert.match(map, /address\.trim\(\)/);
  assert.match(map, /encodeURIComponent/);
  assert.match(map, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.match(map, /NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY/);
  assert.match(map, /https:\/\/www\.google\.com\/maps\/embed\/v1\/place\?key=/);
  assert.match(map, /maps\.embed \?/);
  assert.match(map, /address\?\.trim\(\)/);
  assert.match(map, /rel="noopener noreferrer"/);
  assert.match(map, /referrerPolicy="strict-origin-when-cross-origin"/);
  assert.doesNotMatch(map, /output=embed/);
  assert.doesNotMatch(map, /dangerouslySetInnerHTML|branch\.mapUrl/);
});

test("branch list, detail, and homepage expose Google Maps without inventing an address", async () => {
  const [list, detail, home, styles] = await Promise.all([
    read("app/branches/page.tsx"),
    read("app/branches/[slug]/page.tsx"),
    read("app/page.tsx"),
    read("app/branches/maps.css"),
  ]);

  assert.match(list, /<BranchMap/);
  assert.match(list, /address=\{address\}/);
  assert.match(list, /variant="link"/);
  assert.match(list, /createGoogleMapsUrls/);
  assert.doesNotMatch(list, /branch\.mapUrl/);
  assert.match(detail, /<BranchMap address=\{branch\.address\} branchName=\{branch\.name\} \/>/);
  assert.match(detail, /Vị trí trên Google Maps/);
  assert.doesNotMatch(detail, /branch\.mapUrl/);
  assert.match(home, /className="branch-row__map-link"/);
  assert.match(home, /address=\{branch\.address\}/);
  assert.match(styles, /\.branch-map__iframe/);
  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.doesNotMatch(styles, /gradient/);
});

test("contact page derives map links from branch addresses instead of raw map urls", async () => {
  const contact = await read("app/contact/page.tsx");

  assert.match(contact, /createGoogleMapsUrls/);
  assert.doesNotMatch(contact, /branch\.mapUrl/);
});

test("branch loaders settle only the current request under Strict Mode cleanup", async () => {
  const [list, detail] = await Promise.all([
    read("app/branches/page.tsx"),
    read("app/branches/[slug]/page.tsx"),
  ]);

  for (const source of [list, detail]) {
    assert.match(source, /const requestSequence = useRef\(0\)/);
    assert.match(source, /const requestId = \+\+requestSequence\.current/);
    assert.match(source, /!cancelled && requestSequence\.current === requestId/);
    assert.match(source, /setLoading\(false\)/);
    assert.match(source, /const \[retryCount, setRetryCount\] = useState\(0\)/);
    assert.match(source, /setRetryCount\(\(count\) => count \+ 1\)/);
    assert.match(source, /Thử tải lại/);
  }
  assert.match(list, /async function loadBranches\(\)/);
  assert.match(detail, /async function loadBranch\(\)/);
  assert.doesNotMatch(detail, /Promise\.resolve\(\)/);
});

test("public API requests compose caller cancellation with a bounded timeout", async () => {
  const client = await read("lib/api-client.ts");

  assert.match(client, /const API_REQUEST_TIMEOUT_MS = 12_000/);
  assert.match(client, /const requestController = new AbortController\(\)/);
  assert.match(client, /callerSignal\?\.addEventListener\("abort", abortFromCaller, \{ once: true \}\)/);
  assert.match(client, /setTimeout\(\(\) => \{[\s\S]*timedOut = true;[\s\S]*requestController\.abort\(\);[\s\S]*\}, timeoutMs\)/);
  assert.match(client, /signal: requestController\.signal/);
  assert.match(client, /finally \{/);
  assert.match(client, /clearTimeout\(timeoutId\)/);
  assert.match(client, /callerSignal\?\.removeEventListener\("abort", abortFromCaller\)/);
  assert.match(client, /Không thể kết nối đến hệ thống\. Vui lòng thử lại sau\./);
});
