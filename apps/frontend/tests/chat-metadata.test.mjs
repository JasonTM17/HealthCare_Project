import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const typesPath = new URL("../types/hospital.ts", import.meta.url);
const contractsPath = new URL(
  "../../backend/src/main/java/com/healthcare/ai/chat/dto/ChatContracts.java",
  import.meta.url,
);
const publicControllerPath = new URL(
  "../../backend/src/main/java/com/healthcare/ai/controller/PublicAiChatController.java",
  import.meta.url,
);

test("chat cost metadata survives the AI -> Java -> TS contract (E1)", async () => {
  const [types, contracts, publicController] = await Promise.all([
    readFile(typesPath, "utf8"),
    readFile(contractsPath, "utf8"),
    readFile(publicControllerPath, "utf8"),
  ]);

  // TS message contract carries the observability fields.
  assert.match(types, /usedSources\?: Array<\{ id: string/);
  assert.match(types, /costTier\?: "local_free" \| "remote_llm"/);
  assert.match(types, /routingReason\?: string \| null/);

  // Java message response declares them.
  assert.match(contracts, /record UsedSourceSummary\(/);
  assert.match(contracts, /List<UsedSourceSummary> usedSources,/);
  assert.match(contracts, /String costTier,/);
  assert.match(contracts, /String routingReason,/);

  // Public chat carries cost tier with validation and an honest fallback.
  assert.match(publicController, /publicCostTier/);
  assert.match(publicController, /"local_free" \| |value\.equals\("remote_llm"\)/);
  assert.match(publicController, /"public_catalog_fallback"/);
});
