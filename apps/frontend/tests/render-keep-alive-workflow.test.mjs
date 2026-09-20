import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readWorkflow = () => readFile(new URL("../../../.github/workflows/render-keep-alive.yml", import.meta.url), "utf8");

const getSupabaseJob = (source) => source.slice(source.indexOf("  ping-supabase:"), source.indexOf("  render-health:"));

const getSupabaseStep = (supabaseJob, name, nextName) => {
  const start = supabaseJob.indexOf("      - name: " + name);
  const end = supabaseJob.indexOf("      - name: " + nextName);
  assert.ok(start >= 0, "Supabase workflow step is missing: " + name);
  assert.ok(end > start, "Supabase workflow step boundary is missing: " + nextName);
  return supabaseJob.slice(start, end);
};

const extractFilter = (step, terminal) => {
  const match = step.match(new RegExp("jq_filter='(?<filter>def [\\s\\S]*?^[ \\t]*(?:exactly_one_document \\| )?" + terminal + ")'", "m"));
  assert.ok(match?.groups?.filter, terminal + " jq predicate must be present in the workflow");
  return match.groups.filter;
};

const detectJqRuntime = () => {
  const local = spawnSync("jq", ["--version"], { encoding: "utf8" });
  if (local.status === 0 && !local.error) return { kind: "local", command: "jq" };
  const docker = spawnSync("docker", ["--version"], { encoding: "utf8" });
  if (docker.status === 0 && !docker.error) return { kind: "docker", command: "ghcr.io/jqlang/jq:latest" };
  return null;
};

const runJq = (runtime, filter, body) => {
  const args = ["-e", "-s", filter];
  const result = runtime.kind === "local"
    ? spawnSync("jq", args, { input: body, encoding: "utf8" })
    : spawnSync("docker", ["run", "--rm", "-i", runtime.command, ...args], { input: body, encoding: "utf8" });
  assert.equal(result.error, undefined, result.error?.message ?? "jq execution failed");
  return result.status === 0;
};

test("Supabase keep-alive enforces the documented endpoint schemas", async () => {
  const source = await readWorkflow();
  const supabaseJob = getSupabaseJob(source);
  const sqlStep = getSupabaseStep(supabaseJob, "Execute Active PostgreSQL Query via Supabase API", "Ping Supabase REST Gateway");
  const restStep = getSupabaseStep(supabaseJob, "Ping Supabase REST Gateway", "Ping Supabase Auth Health");
  const authStep = getSupabaseStep(supabaseJob, "Ping Supabase Auth Health", "Verify Inactivity Reset");
  const sqlFilter = extractFilter(sqlStep, "sql_success");
  const restFilter = extractFilter(restStep, "rest_success");
  const authFilter = extractFilter(authStep, "auth_success");

  assert.match(supabaseJob, /Validate Supabase keep-alive configuration/);
  assert.match(supabaseJob, /SUPABASE_ACCESS_TOKEN/);
  assert.match(supabaseJob, /SUPABASE_PROJECT_REF/);
  assert.match(supabaseJob, /SUPABASE_ANON_KEY/);
  assert.match(supabaseJob, /for required in SUPABASE_TOKEN PROJECT_REF SUPABASE_ANON_KEY/);
  assert.match(supabaseJob, /Required Supabase keep-alive secret\/configuration/);
  assert.doesNotMatch(supabaseJob, /\|\| true/, "Supabase probes must not mask curl failures");
  assert.match(supabaseJob, /curl_exit=\$\?/);
  assert.match(supabaseJob, /network\/curl.*exit/);
  assert.match(supabaseJob, /returned HTTP/);
  assert.match(supabaseJob, /jq -e/);
  assert.match(supabaseJob, /jq -e -s/);
  assert.match(supabaseJob, /-o "\$response_file"/, "probe bodies must be validated from temp files");
  assert.match(supabaseJob, /invalid 2xx response body/g, "all successful probes need body validation");
  assert.doesNotMatch(supabaseJob, /echo "Result:/, "probe bodies must not be printed");

  assert.match(sqlFilter, /def sql_success/);
  assert.match(sqlFilter, /def exactly_one_document/);
  assert.match(sqlFilter, /if type != "array" then false/);
  assert.match(sqlFilter, /keep_alive_integer_one/);
  assert.match(sqlFilter, /nonnegative_integer/);
  assert.match(sqlFilter, /keys_unsorted \| sort/);
  assert.match(sqlFilter, /\.\[0\]\.keep_alive \| keep_alive_integer_one/);
  assert.match(sqlFilter, /\.\[0\]\.active_branches \| nonnegative_integer/);
  assert.match(supabaseJob, /if \[ "\$curl_exit" -ne 0 \]; then[\s\S]*?exit 1/);

  assert.match(restStep, /\/rest\/v1\/branches\?select=id&limit=1/);
  assert.equal(restStep.includes("/rest/v1/\""), false, "REST probe must not use the root OpenAPI endpoint");
  assert.match(restFilter, /type != "array"/);
  assert.match(restFilter, /length > 1/);
  assert.match(restFilter, /keys_unsorted \| sort/);
  assert.match(restFilter, /\.id \| nonnull_scalar/);

  assert.match(authFilter, /\["description", "name", "version"\]/);
  assert.match(authFilter, /name != "GoTrue"/);
  assert.match(authFilter, /\.version \| nonempty_string/);
  assert.match(authFilter, /has\("description"\)/);
});

test("Render health retains its fail-loud aggregate exit", async () => {
  const source = await readWorkflow();
  const renderJob = source.slice(source.indexOf("  render-health:"));

  assert.match(renderJob, /for attempt in 1 2 3/);
  assert.match(renderJob, /x-render-routing/);
  assert.match(renderJob, /exit \$failed/);
});

test("Supabase keep-alive actual jq predicates enforce all live contracts", async () => {
  const source = await readWorkflow();
  const supabaseJob = getSupabaseJob(source);
  const runtime = detectJqRuntime();
  assert.ok(runtime, "an actual jq runtime is required (install jq or provide Docker)");

  const sqlFilter = extractFilter(getSupabaseStep(supabaseJob, "Execute Active PostgreSQL Query via Supabase API", "Ping Supabase REST Gateway"), "sql_success");
  const restFilter = extractFilter(getSupabaseStep(supabaseJob, "Ping Supabase REST Gateway", "Ping Supabase Auth Health"), "rest_success");
  const authFilter = extractFilter(getSupabaseStep(supabaseJob, "Ping Supabase Auth Health", "Verify Inactivity Reset"), "auth_success");
  const accepts = (status, filter, body) => /^2\d{2}$/.test(String(status)) && runJq(runtime, filter, body);

  for (const [status, body] of [
    [200, JSON.stringify([{ keep_alive: 1, active_branches: 0 }])],
    [201, JSON.stringify([{ keep_alive: 1, active_branches: 20 }])],
    [200, JSON.stringify([{ active_branches: 20, keep_alive: 1 }])],
  ]) assert.equal(accepts(status, sqlFilter, body), true, "SQL should accept " + status + " " + body);
  for (const status of ["000", 199, 300, 401, 500]) {
    assert.equal(accepts(status, sqlFilter, JSON.stringify([{ keep_alive: 1, active_branches: 20 }])), false, "SQL HTTP " + status + " must fail closed");
  }
  for (const fixture of [
    [],
    {},
    { keep_alive: 1, active_branches: 20 },
    [{ keep_alive: 1, active_branches: 20 }, { keep_alive: 1, active_branches: 20 }],
    [{ keep_alive: 1, active_branches: 20 }, []],
    [{ keep_alive: 1 }],
    [{ active_branches: 20 }],
    [{ keep_alive: 1, active_branches: -1 }],
    [{ keep_alive: 1, active_branches: 1.5 }],
    [{ keep_alive: 1, active_branches: "20" }],
    [{ keep_alive: 1, active_branches: null }],
    [{ keep_alive: 1, active_branches: false }],
    [{ keep_alive: 0, active_branches: 20 }],
    [{ keep_alive: 2, active_branches: 20 }],
    [{ keep_alive: "1", active_branches: 20 }],
    [{ keep_alive: null, active_branches: 20 }],
    [{ keep_alive: 1.5, active_branches: 20 }],
    [{ keep_alive: true, active_branches: 20 }],
    [{ keep_alive: 1, active_branches: 20, error: "permission denied" }],
    [{ keep_alive: 1, active_branches: 20, extra: true }],
    [{ data: { keep_alive: 1, active_branches: 20 } }],
    { data: [{ keep_alive: 1, active_branches: 20 }] },
    [[{ keep_alive: 1, active_branches: 20 }]],
  ]) assert.equal(accepts(200, sqlFilter, JSON.stringify(fixture)), false, JSON.stringify(fixture));
  assert.equal(accepts(200, sqlFilter, "{\"keep_alive\":1,"), false, "SQL malformed JSON must fail closed");
  for (const body of [
    "[{\"error\":\"invalid\"}]\n[{\"keep_alive\":1,\"active_branches\":20}]",
    "[{\"keep_alive\":1,\"active_branches\":20}]\n[{\"keep_alive\":1,\"active_branches\":20}]",
    "[{\"keep_alive\":1,\"active_branches\":Infinity}]",
    "[{\"keep_alive\":1,\"active_branches\":-Infinity}]",
    "[{\"keep_alive\":1,\"active_branches\":NaN}]",
  ]) assert.equal(accepts(200, sqlFilter, body), false, "SQL must reject multiple JSON roots");

  for (const [status, body] of [
    [200, "[]"],
    [200, JSON.stringify([{ id: "branch-1" }])],
    [201, JSON.stringify([{ id: 42 }])],
  ]) assert.equal(accepts(status, restFilter, body), true, "REST should accept " + status + " " + body);
  for (const status of ["000", 199, 300, 401, 500]) {
    assert.equal(accepts(status, restFilter, "[]"), false, "REST HTTP " + status + " must fail closed");
  }
  for (const fixture of [
    [{ id: "a" }, { id: "b" }],
    [{}],
    [{ id: null }],
    [{ id: { nested: true } }],
    [{ id: ["nested"] }],
    [{ id: "branch-1", extra: true }],
    [{ id: "branch-1", error: "denied" }],
    { error: "denied" },
    { data: [{ id: "branch-1" }] },
    { id: "branch-1" },
  ]) assert.equal(accepts(200, restFilter, JSON.stringify(fixture)), false, JSON.stringify(fixture));
  assert.equal(accepts(200, restFilter, "[{\"id\":"), false, "REST malformed JSON must fail closed");
  for (const body of [
    "{\"error\":\"invalid\"}\n[]",
    "[]\n[]",
    "[{\"id\":Infinity}]",
    "[{\"id\":-Infinity}]",
    "[{\"id\":NaN}]",
  ]) assert.equal(accepts(200, restFilter, body), false, "REST must reject multiple JSON roots");

  for (const [status, body] of [
    [200, JSON.stringify({ name: "GoTrue", version: "v2.197.0" })],
    [200, JSON.stringify({ name: "GoTrue", version: "v2.197.0", description: "GoTrue is a user registration and authentication API" })],
    [201, JSON.stringify({ name: "GoTrue", version: "v2.197.0" })],
  ]) assert.equal(accepts(status, authFilter, body), true, "Auth should accept " + status + " " + body);
  for (const status of ["000", 199, 300, 401, 500]) {
    assert.equal(accepts(status, authFilter, JSON.stringify({ name: "GoTrue", version: "v2.197.0" })), false, "Auth HTTP " + status + " must fail closed");
  }
  for (const fixture of [
    {},
    [],
    { name: "GoTrue" },
    { name: "gotrue", version: "v2.197.0" },
    { name: "GoTrue", version: "" },
    { name: "GoTrue", version: "v2.197.0", description: "" },
    { name: "GoTrue", version: "v2.197.0", description: null },
    { name: "GoTrue", version: "v2.197.0", status: "ok" },
    { name: "GoTrue", version: "v2.197.0", ok: true },
    { name: "GoTrue", version: "v2.197.0", success: false },
    { name: "GoTrue", version: "v2.197.0", error: "denied" },
    { name: "GoTrue", version: "v2.197.0", errors: ["denied"] },
    { name: "GoTrue", version: "v2.197.0", code: "denied" },
    { name: "GoTrue", version: "v2.197.0", error_code: "denied" },
    { name: "GoTrue", version: "v2.197.0", message: "denied" },
    { name: "GoTrue", version: "v2.197.0", hint: "retry" },
    { name: "GoTrue", version: "v2.197.0", details: "denied" },
    { data: { name: "GoTrue", version: "v2.197.0" } },
  ]) assert.equal(accepts(200, authFilter, JSON.stringify(fixture)), false, JSON.stringify(fixture));
  assert.equal(accepts(200, authFilter, "{\"name\":\"GoTrue\","), false, "Auth malformed JSON must fail closed");
  for (const body of [
    "{\"error\":\"invalid\"}\n{\"name\":\"GoTrue\",\"version\":\"v2.197.0\"}",
    "{\"name\":\"GoTrue\",\"version\":\"v2.197.0\"}\n{\"name\":\"GoTrue\",\"version\":\"v2.197.0\"}",
  ]) assert.equal(accepts(200, authFilter, body), false, "Auth must reject multiple JSON roots");
});
