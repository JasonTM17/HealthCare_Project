import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("SearchPageClient eradicates false red error banner when results exist", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  // Must only render error banner when resultCount === 0
  assert.match(
    source,
    /resultCount === 0 && semanticError/,
    "SearchPageClient must guard semanticError with resultCount === 0",
  );
  assert.doesNotMatch(
    source,
    /\{\s*semanticError\s*\?\s*<p className="catalog-status catalog-status--error"/,
    "SearchPageClient must not render red error banner when results exist",
  );
});

test("SearchPageClient implements accurate category filter tabs", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  // Verify tab definitions
  for (const label of ["Tất cả", "Chuyên khoa", "Bác sĩ", "Gói khám", "Dịch vụ", "Bài viết"]) {
    assert.match(source, new RegExp(`"${label}"`), `Missing category tab: ${label}`);
  }

  // Verify tab list attributes & accessibility
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected/);
  assert.match(source, /activeCategory/);
  assert.match(source, /categoryCounts/);
  assert.match(source, /search-category-tabs/);

  // Verify category filtering guards for each section
  assert.match(source, /activeCategory === "ALL" \|\| activeCategory === "SPECIALTY"/);
  assert.match(source, /activeCategory === "ALL" \|\| activeCategory === "DOCTOR"/);
  assert.match(source, /activeCategory === "ALL" \|\| activeCategory === "PACKAGE"/);
  assert.match(source, /activeCategory === "ALL" \|\| activeCategory === "SERVICE"/);
  assert.match(source, /activeCategory === "ALL" \|\| activeCategory === "ARTICLE"/);
});

test("SearchPageClient normalization strips Vietnamese diacritics accurately", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  assert.match(source, /\.normalize\("NFD"\)/);
  assert.match(source, /\[\\u0300-\\u036f\]/);
  assert.match(source, /\/đ\/g/);

  // Test equivalent normalization logic
  function normalize(value) {
    return value
      .trim()
      .toLocaleLowerCase("vi-VN")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  }

  function matches(query, values) {
    const normalizedQuery = normalize(query);
    return values.some((value) => value && normalize(value).includes(normalizedQuery));
  }

  // Test diacritic stripping
  assert.equal(normalize("Tim mạch"), "tim mach");
  assert.equal(normalize("tim mach"), "tim mach");
  assert.equal(normalize("Nhi khoa"), "nhi khoa");
  assert.equal(normalize("nhi khoa"), "nhi khoa");
  assert.equal(normalize("Đa khoa"), "da khoa");
  assert.equal(normalize("da khoa"), "da khoa");
  assert.equal(normalize("Điều dưỡng"), "dieu duong");
  assert.equal(normalize("dieu duong"), "dieu duong");

  // Test search matching
  assert.ok(matches("tim mach", ["Chuyên khoa Tim mạch can thiệp", "tim-mach"]));
  assert.ok(matches("Tim mạch", ["Chuyên khoa Tim mạch can thiệp", "tim-mach"]));
  assert.ok(matches("nhi khoa", ["Bác sĩ Nhi khoa hàng đầu", "nhi-khoa"]));
  assert.ok(matches("Nhi khoa", ["Bác sĩ Nhi khoa hàng đầu", "nhi-khoa"]));
  assert.ok(matches("da khoa", ["Khám sức khỏe tổng quát đa khoa", "da-khoa"]));
  assert.ok(matches("Đa khoa", ["Khám sức khỏe tổng quát đa khoa", "da-khoa"]));
  assert.ok(matches("dieu duong", ["Dịch vụ chăm sóc điều dưỡng", "dieu-duong"]));
});

test("SearchPageClient publishes catalog groups progressively", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  assert.doesNotMatch(source, /Promise\.allSettled\(/, "catalog groups must not wait on one aggregate settlement");
  // Each group gets an independent request path (and, since the retry fix,
  // the same path a failed group can re-enter on its own).
  assert.match(source, /const loadGroup = useCallback\(/, "each catalog group must have an independent request path");
  assert.match(source, /for \(const group of SEARCH_GROUP_KEYS\) loadGroup\(group\);/, "every group starts on its own request");
  assert.match(source, /setCatalog\(/, "a settled group must publish its own catalog data");
  assert.match(source, /status === "loading"/, "the UI must track pending groups independently");
  assert.match(source, /Các nhóm đã sẵn sàng vẫn đang hiển thị/, "slow groups must not hide ready results");
  assert.doesNotMatch(source, /disabled=\{loading\}/, "search submission must stay available while a group is slow");
});

test("SearchPageClient discloses the bounded catalog continuation", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  assert.match(source, /const SEARCH_PAGE_CAP = 3/);
  assert.match(source, /truncated: totalPages > maxPages/);
  assert.match(source, /truncatedGroupKeys/);
  assert.match(source, /Các nhóm này còn dữ liệu phía sau/);
  assert.match(source, /catalogSettled && result && resultCount === 0/, "empty state must wait for every group to settle");
  assert.match(source, /loadedCatalogGroupCount === 0/, "partial failures must not hide a truthful empty result");
  assert.match(source, /function validateCatalogPage/, "malformed page envelopes must fail closed");
  assert.match(source, /function doctorResultMeta/, "same-name doctors need a stable public disambiguator");
  assert.match(source, /branchNames/, "doctor result metadata must include branch context");
  assert.match(source, /const sessionAuthorityKey = authSession/, "session identity must be explicit");
  assert.match(source, /Date\.parse\(authSession\.absoluteExpiresAt\)/, "session authority must use the parsed absolute expiry");
  assert.match(source, /const semanticAuthorityKey = sessionAuthorityKey && semanticQuery/, "semantic state must have an auth/query authority key");
  assert.match(source, /const \[semanticResultKey, setSemanticResultKey\] = useState<string \| null>/, "resolved results need a key separate from loading state");
  assert.match(source, /const semanticStateVisible = Boolean\(semanticAuthorityKey && semanticStateKey === semanticAuthorityKey\)/, "loading/error state must be visible only for its active authority key");
  assert.match(source, /const semanticVisible = Boolean\(semanticStateVisible && semanticResultKey === semanticAuthorityKey\)/, "results must be visible only for the resolved authority key");
  assert.match(source, /semanticStateVisible && semanticLoading/, "semantic loading must be hidden when auth or query is absent");
  assert.match(source, /semanticStateVisible && resultCount === 0 && semanticError/, "semantic errors must be hidden when auth or query is absent");
  assert.match(source, /semanticVisible && semantic\?\.results\.length/, "stale semantic results must be hidden when auth or query is absent");
  assert.match(source, /setSemanticResultKey\(null\)/, "new authority transitions must invalidate the previous result");
  assert.doesNotMatch(source, /if \(!submittedQuery \|\| !authSession\)\s*\{\s*setSemantic\(null\)/, "auth transition effect must not synchronously clear state");
});

test("SearchPageClient rejects stale semantic authority transitions", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  assert.match(source, /useRef<string \| null>/, "active authority must be observable by late callbacks");
  assert.match(source, /authSession\.user\.id/);
  assert.match(source, /authSession\.absoluteExpiresAt/);
  assert.match(source, /Date\.parse\(authSession\.absoluteExpiresAt\)/);
  assert.match(source, /semanticQuery = submittedQuery\.trim\(\)/);
  assert.match(source, /const capturedAuthorityKey = semanticAuthorityKey/);
  assert.match(source, /semanticAuthorityKeyRef\.current === capturedAuthorityKey/);
  assert.match(source, /if \(isCurrentAuthority\(\)\) \{\s*setSemantic\(response\);\s*setSemanticResultKey\(capturedAuthorityKey\);/);
  assert.match(source, /if \(isCurrentAuthority\(\)\) \{[\s\S]*setSemanticError/);

  const authorityKey = (session, submittedQuery) => {
    const query = submittedQuery.trim();
    return session && query
      ? `${session.user.id}\u0000${Date.parse(session.absoluteExpiresAt)}\u0000${query}`
      : null;
  };
  const userOneExpiryA = { user: { id: "user-one" }, absoluteExpiresAt: "2030-01-01T00:00:00.000Z" };
  const userOneExpiryB = { user: { id: "user-one" }, absoluteExpiresAt: "2030-01-02T00:00:00.000Z" };
  const userTwoExpiryA = { user: { id: "user-two" }, absoluteExpiresAt: userOneExpiryA.absoluteExpiresAt };
  const oldKey = authorityKey(userOneExpiryA, "  tim mach  ");

  assert.equal(oldKey, authorityKey(userOneExpiryA, "tim mach"), "only the exact trimmed query belongs in the key");
  assert.notEqual(oldKey, authorityKey(userOneExpiryA, "tim mạch"), "query replacement must supersede the old authority");
  assert.notEqual(oldKey, authorityKey(userOneExpiryB, "tim mach"), "same user with a new expiry must supersede the old authority");
  assert.notEqual(oldKey, authorityKey(userTwoExpiryA, "tim mach"), "a different user must supersede the old authority");
  assert.equal(authorityKey(null, "tim mach"), null, "logout must remove the active authority");
  assert.equal(authorityKey(userOneExpiryA, "   "), null, "an empty submitted query must remove the active authority");

  const visibleResult = (state, activeKey) => (
    activeKey && state.stateKey === activeKey && state.resultKey === activeKey ? state.result : null
  );
  const beginRequest = (state, activeKey) => ({
    stateKey: activeKey,
    resultKey: null,
    result: null,
  });
  const settleRequest = (state, capturedKey, activeKey, result) => (
    capturedKey === activeKey
      ? { ...state, resultKey: capturedKey, result }
      : state
  );

  let state = beginRequest({ stateKey: null, resultKey: null, result: null }, oldKey);
  state = settleRequest(state, oldKey, oldKey, { owner: "user-one" });
  assert.deepEqual(visibleResult(state, oldKey), { owner: "user-one" });

  for (const nextKey of [
    null,
    authorityKey(userTwoExpiryA, "tim mach"),
    authorityKey(userOneExpiryB, "tim mach"),
    authorityKey(userOneExpiryA, "new query"),
  ]) {
    state = beginRequest(state, nextKey);
    assert.equal(visibleResult(state, nextKey), null, "a replacement authority starts without the previous result");
    state = settleRequest(state, oldKey, nextKey, { owner: "stale-user-one" });
    assert.equal(visibleResult(state, nextKey), null, "a late old response cannot overwrite the replacement authority");
    if (nextKey) {
      state = settleRequest(state, nextKey, nextKey, { owner: "current-authority" });
      assert.deepEqual(visibleResult(state, nextKey), { owner: "current-authority" });
    }
  }
});

test("failed catalog groups get their own retry while loaded groups stay put", async () => {
  const source = await read("app/search/SearchPageClient.tsx");

  // The bounded pipeline is extracted once, so a retry runs the exact same
  // fetch as the initial load instead of a divergent second copy.
  assert.match(source, /function loadCatalogGroup\(group: SearchGroupKey\)/);
  assert.match(source, /for \(const group of SEARCH_GROUP_KEYS\) loadGroup\(group\);/);

  // Each failed group gets a "Thử lại" button that re-runs only that group.
  assert.match(source, /failedGroupKeys\.length > 0/);
  assert.match(
    source,
    /failedGroupKeys\.map\(\(group\) => \(\s*<button[\s\S]*?onClick=\{\(\) => loadGroup\(group\)\}[\s\S]*?Thử lại/,
  );
  assert.match(source, /aria-label=\{`Thử tải lại nhóm \$\{SEARCH_GROUP_LABELS\[group\]\}`\}/);

  // A successful retry clears just that group from the failed set; the
  // aggregate line remains for whatever is still missing.
  assert.match(source, /setFailedGroupKeys\(\(previous\) => \(previous\.includes\(group\) \? previous\.filter\(\(key\) => key !== group\) : previous\)\)/);
  assert.match(source, /Một phần thông tin tạm thời chưa thể hiển thị \(\$\{failedGroupKeys\.length\}\/5 nhóm\)/);

  // A late response from a superseded attempt cannot overwrite newer state.
  assert.match(source, /if \(!mountedRef\.current \|\| groupRunRef\.current\[group\] !== runId\) return;/);
});
