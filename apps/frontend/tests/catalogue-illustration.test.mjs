import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadCatalogueIllustration } from "./helpers/catalogue-illustration-loader.mjs";

const bytes = readFileSync(new URL("../lib/catalogue-illustration.json", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const identity = JSON.parse(bytes);
const catalogue = loadCatalogueIllustration();

test("immutable 232 identities match the reviewed packet and backend resource", () => {
  assert.equal(identity.ids.length, 232);
  assert.equal(new Set(identity.ids).size, 232);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "3893093f1447f1900a31b5128f628287d88050d6e8303510cc655bd6011b0df2");
  assert.deepEqual(JSON.parse(readFileSync(new URL("../../backend/src/main/resources/catalogue-illustration.json", import.meta.url), "utf8")), identity);
});

test("renaming any sample preserves classification; real entries remain bookable", () => {
  for (const id of identity.ids) assert.equal(catalogue.isIllustrativeCatalogue({ id: id.toUpperCase(), slug: "renamed", name: "Tên thật" }), true);
  assert.equal(catalogue.isIllustrativeCatalogue({ id: "00000000-0000-4000-8000-000000000001", slug: "minh-hoa-261009-additional" }), true);
  assert.equal(catalogue.isIllustrativeCatalogue({ id: "00000000-0000-4000-8000-000000000001", slug: "real-catalogue" }), false);
  assert.equal(catalogue.isIllustrativeCatalogue(null), false);
  for (const key of ["doctorId", "branchId", "packageId"]) assert.equal(catalogue.isIllustrativeSelection({ [key]: identity.ids[0] }), true);
});

test("branch filtering also removes nested illustrative doctor summaries", () => {
  const real = { id: "00000000-0000-4000-8000-000000000001", slug: "real", doctors: [{ id: identity.ids[0], slug: "renamed" }, { id: "00000000-0000-4000-8000-000000000002", slug: "real-doctor" }] };
  const result = catalogue.bookableBranches([real, { id: identity.ids[1], slug: "renamed", doctors: [] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].doctors.length, 1);
  assert.equal(result[0].doctors[0].id, real.doctors[1].id);
  assert.equal(real.doctors.length, 2, "filtering must preserve caller-owned catalogues");
});
