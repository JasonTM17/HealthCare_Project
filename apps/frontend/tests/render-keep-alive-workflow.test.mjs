import assert from "node:assert/strict";
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

// ── A minimal in-process jq subset ──────────────────────────────────────────
//
// The workflow's jq predicates are the executable oracle for the Supabase probe
// response shapes. Running them used to require a `jq` binary on PATH (or
// Docker), which made this suite unrunnable on a workstation without either.
// The subset below is parsed from the SAME extracted filter text, so the filter
// stays the single source of truth and the suite needs nothing but Node.

const JQ_PUNCTUATION = ["|", ";", ",", "(", ")", "[", "]", "==", "!=", ">=", "<=", ">", "<", ":"];

function tokenizeJq(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "#") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (character === '"') {
      let cursor = index + 1;
      let text = "";
      while (cursor < source.length && source[cursor] !== '"') {
        if (source[cursor] === "\\") {
          const escape = source[cursor + 1];
          if (escape === "u") {
            text += String.fromCharCode(Number.parseInt(source.slice(cursor + 2, cursor + 6), 16));
            cursor += 6;
            continue;
          }
          text += escape === "n" ? "\n" : escape === "t" ? "\t" : escape === "r" ? "\r" : escape;
          cursor += 2;
          continue;
        }
        text += source[cursor];
        cursor += 1;
      }
      assert.equal(source[cursor], '"', "unterminated jq string literal");
      tokens.push({ kind: "string", value: text });
      index = cursor + 1;
      continue;
    }
    if (character === ".") {
      const field = /^\.([A-Za-z_][A-Za-z0-9_]*)/.exec(source.slice(index));
      if (field) {
        tokens.push({ kind: "field", value: field[1] });
        index += field[0].length;
        continue;
      }
      tokens.push({ kind: "identity" });
      index += 1;
      continue;
    }
    const number = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index));
    if (number) {
      tokens.push({ kind: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index));
    if (identifier) {
      tokens.push({ kind: "identifier", value: identifier[0] });
      index += identifier[0].length;
      continue;
    }
    const punctuation = JQ_PUNCTUATION.find((token) => source.startsWith(token, index));
    if (punctuation) {
      tokens.push({ kind: "punctuation", value: punctuation });
      index += punctuation.length;
      continue;
    }
    throw new Error(`unsupported jq token: ${JSON.stringify(source.slice(index, index + 12))}`);
  }
  return tokens;
}

function parseJq(source) {
  const tokens = tokenizeJq(source);
  const definitions = new Map();
  let position = 0;
  const peek = () => tokens[position];
  const isPunctuation = (value) => peek()?.kind === "punctuation" && peek().value === value;
  const isIdentifier = (value) => peek()?.kind === "identifier" && peek().value === value;
  const expectPunctuation = (value) => {
    assert.ok(isPunctuation(value), `expected jq punctuation ${value}`);
    position += 1;
  };

  const parsePostfix = (node) => {
    const token = peek();
    if (token?.kind === "field") {
      position += 1;
      return parsePostfix({ type: "field", source: node, name: token.value });
    }
    if (!isPunctuation("[")) return node;
    position += 1;
    if (isPunctuation("]")) {
      position += 1;
      return parsePostfix({ type: "iterate", source: node });
    }
    const indexExpression = parseExpression();
    expectPunctuation("]");
    return parsePostfix({ type: "index", source: node, index: indexExpression });
  };

  const parsePrimary = () => {
    const token = peek();
    assert.ok(token, "unexpected end of jq filter");
    if (token.kind === "number" || token.kind === "string") {
      position += 1;
      return parsePostfix({ type: "literal", value: token.value });
    }
    if (token.kind === "identity") {
      position += 1;
      return parsePostfix({ type: "identity" });
    }
    if (token.kind === "field") {
      position += 1;
      return parsePostfix({ type: "field", source: null, name: token.value });
    }
    if (isPunctuation("(")) {
      position += 1;
      const inner = parseExpression();
      expectPunctuation(")");
      return parsePostfix(inner);
    }
    if (isPunctuation("[")) {
      position += 1;
      const items = [];
      while (!isPunctuation("]")) {
        items.push(parseExpression());
        if (isPunctuation(",")) position += 1;
      }
      expectPunctuation("]");
      return parsePostfix({ type: "array", items });
    }
    assert.equal(token.kind, "identifier", `unsupported jq expression: ${JSON.stringify(token)}`);
    position += 1;
    if (token.value === "true") return parsePostfix({ type: "literal", value: true });
    if (token.value === "false") return parsePostfix({ type: "literal", value: false });
    if (token.value === "null") return parsePostfix({ type: "literal", value: null });
    const args = [];
    if (isPunctuation("(")) {
      position += 1;
      while (!isPunctuation(")")) {
        args.push(parseExpression());
        if (isPunctuation(";") || isPunctuation(",")) {
          position += 1;
          continue;
        }
        assert.ok(isPunctuation(")"), "expected jq argument separator");
      }
      expectPunctuation(")");
    }
    return parsePostfix({ type: "call", name: token.value, args });
  };

  const parseComparison = () => {
    let node = parsePrimary();
    while (peek()?.kind === "punctuation" && ["==", "!=", ">=", "<=", ">", "<"].includes(peek().value)) {
      const operator = tokens[position].value;
      position += 1;
      node = { type: "compare", operator, left: node, right: parsePrimary() };
    }
    return node;
  };
  const parseAnd = () => {
    let node = parseComparison();
    while (isIdentifier("and")) {
      position += 1;
      node = { type: "and", left: node, right: parseComparison() };
    }
    return node;
  };
  const parseOr = () => {
    let node = parseAnd();
    while (isIdentifier("or")) {
      position += 1;
      node = { type: "or", left: node, right: parseAnd() };
    }
    return node;
  };
  const parsePipe = () => {
    let node = parseOr();
    while (isPunctuation("|")) {
      position += 1;
      node = { type: "pipe", left: node, right: parseOr() };
    }
    return node;
  };
  const parseConditional = () => {
    const condition = parseExpression();
    assert.ok(isIdentifier("then"), "expected jq then");
    position += 1;
    const consequent = parseExpression();
    let alternate = { type: "literal", value: null };
    if (isIdentifier("elif")) {
      position += 1;
      alternate = parseConditional();
    } else if (isIdentifier("else")) {
      position += 1;
      alternate = parseExpression();
    }
    return { type: "if", condition, consequent, alternate };
  };
  const parseExpression = () => {
    if (isIdentifier("if")) {
      position += 1;
      const node = parseConditional();
      assert.ok(isIdentifier("end"), "expected jq end");
      position += 1;
      return node;
    }
    return parsePipe();
  };

  while (isIdentifier("def")) {
    position += 1;
    const name = tokens[position];
    assert.equal(name?.kind, "identifier", "expected jq definition name");
    position += 1;
    expectPunctuation(":");
    const body = parseExpression();
    expectPunctuation(";");
    definitions.set(name.value, body);
  }
  const main = parseExpression();
  assert.equal(position, tokens.length, "trailing jq tokens");
  return { definitions, main };
}

const jqTruthy = (value) => value !== false && value !== null && value !== undefined;

function jqTypeOf(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  return "object";
}

const JQ_TYPE_ORDER = { null: 0, boolean: 1, number: 2, string: 3, array: 4, object: 5 };

function jqCompare(left, right) {
  const leftType = jqTypeOf(left);
  const rightType = jqTypeOf(right);
  if (leftType !== rightType) return JQ_TYPE_ORDER[leftType] < JQ_TYPE_ORDER[rightType] ? -1 : 1;
  if (leftType === "number") {
    if (Number.isNaN(left) || Number.isNaN(right)) return NaN;
    if (left === right) return 0;
    return left < right ? -1 : 1;
  }
  if (leftType === "string" || leftType === "boolean") {
    if (left === right) return 0;
    return left < right ? -1 : 1;
  }
  if (leftType === "array") {
    const shared = Math.min(left.length, right.length);
    for (let index = 0; index < shared; index += 1) {
      const comparison = jqCompare(left[index], right[index]);
      if (comparison !== 0) return comparison;
    }
    return left.length === right.length ? 0 : left.length < right.length ? -1 : 1;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  const keysComparison = jqCompare(leftKeys, rightKeys);
  if (keysComparison !== 0) return keysComparison;
  for (const key of leftKeys) {
    const comparison = jqCompare(left[key], right[key]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function evaluateJq(node, input, definitions) {
  switch (node.type) {
    case "literal":
      return [node.value];
    case "identity":
      return [input];
    case "field": {
      const source = node.source ? evaluateJq(node.source, input, definitions)[0] : input;
      return [
        jqTypeOf(source) === "object" && Object.prototype.hasOwnProperty.call(source, node.name)
          ? source[node.name]
          : null,
      ];
    }
    case "index": {
      const source = evaluateJq(node.source, input, definitions)[0];
      const index = evaluateJq(node.index, input, definitions)[0];
      if (Array.isArray(source) && Number.isInteger(index)) return [source[index] ?? null];
      if (jqTypeOf(source) === "object" && typeof index === "string") return [source[index] ?? null];
      return [null];
    }
    case "iterate": {
      const source = evaluateJq(node.source, input, definitions)[0];
      if (Array.isArray(source)) return [...source];
      if (jqTypeOf(source) === "object") return Object.values(source);
      return [];
    }
    case "array":
      return [node.items.map((item) => evaluateJq(item, input, definitions).at(-1))];
    case "pipe": {
      const values = evaluateJq(node.left, input, definitions);
      return values.flatMap((value) => evaluateJq(node.right, value, definitions));
    }
    case "and": {
      const results = [];
      for (const leftValue of evaluateJq(node.left, input, definitions)) {
        if (!jqTruthy(leftValue)) {
          results.push(false);
          continue;
        }
        for (const rightValue of evaluateJq(node.right, input, definitions)) results.push(jqTruthy(rightValue));
      }
      return results.length > 0 ? results : [false];
    }
    case "or": {
      const results = [];
      for (const leftValue of evaluateJq(node.left, input, definitions)) {
        if (jqTruthy(leftValue)) {
          results.push(true);
          continue;
        }
        for (const rightValue of evaluateJq(node.right, input, definitions)) results.push(jqTruthy(rightValue));
      }
      return results.length > 0 ? results : [false];
    }
    case "compare": {
      const leftValue = evaluateJq(node.left, input, definitions).at(-1);
      const rightValue = evaluateJq(node.right, input, definitions).at(-1);
      const comparison = jqCompare(leftValue, rightValue);
      if (Number.isNaN(comparison)) {
        return [node.operator === "!="];
      }
      switch (node.operator) {
        case "==": return [comparison === 0];
        case "!=": return [comparison !== 0];
        case ">": return [comparison > 0];
        case ">=": return [comparison >= 0];
        case "<": return [comparison < 0];
        default: return [comparison <= 0];
      }
    }
    case "if":
      return jqTruthy(evaluateJq(node.condition, input, definitions).at(-1))
        ? evaluateJq(node.consequent, input, definitions)
        : evaluateJq(node.alternate, input, definitions);
    case "call": {
      if (definitions.has(node.name)) return evaluateJq(definitions.get(node.name), input, definitions);
      const args = () => node.args.map((argument) => evaluateJq(argument, input, definitions).at(-1));
      switch (node.name) {
        case "type":
          return [jqTypeOf(input)];
        case "length": {
          if (Array.isArray(input)) return [input.length];
          if (typeof input === "string") return [input.length];
          if (jqTypeOf(input) === "object") return [Object.keys(input).length];
          if (typeof input === "number") return [Math.abs(input)];
          return [null];
        }
        case "keys_unsorted":
          return [jqTypeOf(input) === "object" ? Object.keys(input) : null];
        case "sort":
          return [Array.isArray(input) ? [...input].sort(jqCompare) : null];
        case "isfinite":
          return [typeof input === "number" && Number.isFinite(input)];
        case "floor":
          return [typeof input === "number" && Number.isFinite(input) ? Math.floor(input) : null];
        case "not":
          return [!jqTruthy(input)];
        case "has": {
          const [key] = args();
          return [jqTypeOf(input) === "object" && Object.prototype.hasOwnProperty.call(input, key)];
        }
        case "all": {
          const [generator, condition] = node.args;
          return [
            evaluateJq(generator, input, definitions).every((item) =>
              jqTruthy(evaluateJq(condition, item, definitions).at(-1))),
          ];
        }
        default:
          throw new Error(`unsupported jq function: ${node.name}`);
      }
    }
    default:
      throw new Error(`unsupported jq node: ${node.type}`);
  }
}

/** `jq -s`: slurp every JSON document in the stream into one array. */
function slurpJqDocuments(text) {
  let position = 0;
  const documents = [];
  const fail = () => {
    throw new Error(`invalid JSON document at ${position}: ${JSON.stringify(text.slice(position, position + 16))}`);
  };
  const skipWhitespace = () => {
    while (position < text.length && /\s/.test(text[position])) position += 1;
  };
  const parseString = () => {
    position += 1;
    let value = "";
    while (position < text.length && text[position] !== '"') {
      if (text[position] === "\\") {
        const escape = text[position + 1];
        if (escape === "u") {
          value += String.fromCharCode(Number.parseInt(text.slice(position + 2, position + 6), 16));
          position += 6;
          continue;
        }
        value += escape === "n" ? "\n" : escape === "t" ? "\t" : escape === "r" ? "\r" : escape;
        position += 2;
        continue;
      }
      value += text[position];
      position += 1;
    }
    if (text[position] !== '"') fail();
    position += 1;
    return value;
  };
  const parseNumber = () => {
    const match = /^-?(?:Infinity|NaN|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(position));
    if (!match) fail();
    position += match[0].length;
    return Number(match[0]);
  };
  const parseValue = () => {
    skipWhitespace();
    const character = text[position];
    if (character === "{") {
      position += 1;
      const object = {};
      skipWhitespace();
      if (text[position] === "}") {
        position += 1;
        return object;
      }
      while (true) {
        skipWhitespace();
        if (text[position] !== '"') fail();
        const key = parseString();
        skipWhitespace();
        if (text[position] !== ":") fail();
        position += 1;
        object[key] = parseValue();
        skipWhitespace();
        if (text[position] === ",") {
          position += 1;
          continue;
        }
        if (text[position] === "}") {
          position += 1;
          return object;
        }
        fail();
      }
    }
    if (character === "[") {
      position += 1;
      const items = [];
      skipWhitespace();
      if (text[position] === "]") {
        position += 1;
        return items;
      }
      while (true) {
        items.push(parseValue());
        skipWhitespace();
        if (text[position] === ",") {
          position += 1;
          continue;
        }
        if (text[position] === "]") {
          position += 1;
          return items;
        }
        fail();
      }
    }
    if (character === '"') return parseString();
    for (const [literal, value] of [["true", true], ["false", false], ["null", null]]) {
      if (text.startsWith(literal, position)) {
        position += literal.length;
        return value;
      }
    }
    return parseNumber();
  };

  skipWhitespace();
  while (position < text.length) {
    documents.push(parseValue());
    skipWhitespace();
  }
  return documents;
}

/** Equivalent of `jq -e -s "$filter"` reading `body` from stdin. */
function runJqFilter(filter, body) {
  let program;
  let documents;
  try {
    program = parseJq(filter);
    documents = slurpJqDocuments(body);
  } catch {
    // `jq -e -s` exits non-zero on a malformed document (or an unsupported
    // filter), and every workflow probe treats a non-zero exit as a failure.
    return false;
  }
  return jqTruthy(evaluateJq(program.main, documents, program.definitions).at(-1));
}

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

test("Render health keeps its fail-loud aggregate exit inside a cold-start probe window", async () => {
  const source = await readWorkflow();
  const renderJob = source.slice(source.indexOf("  render-health:"));

  assert.match(renderJob, /for attempt in 1 2 3/);
  assert.match(renderJob, /exit \$failed/);
  assert.match(renderJob, /::error::Render service '\$name' is DOWN after 3 attempts/);
  assert.match(renderJob, /\$code" = "200"/, "only a 200 may be treated as healthy");
  assert.match(renderJob, /healthcare-beta-backend-4wb7\.onrender\.com\/actuator\/health/);
  assert.match(renderJob, /healthcare-beta-ai-9mip\.onrender\.com\/livez/);

  // Cloudflare fronts Render, so Render's own router header never reaches this
  // job. The old `x-render-routing` gate could only ever read `absent`, which
  // silently disabled it; health must be decided by the status code alone.
  const headerLookups = [...renderJob.matchAll(/tolower\(\$1\)=="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(headerLookups, ["x-render-origin-server"], "only the surviving render header may be read");
  assert.doesNotMatch(renderJob, /"no-server"/, "the dead router value must not gate health again");
  assert.match(renderJob, /Informational only/);
  assert.doesNotMatch(renderJob, /routing=\$/);

  // Measured cold starts: backend 20.4 s, AI 42.5 s. A 45 s ceiling aborted the
  // probe mid-boot and reported a healthy service as down. One curl call inside
  // the loop serves both services, so its ceiling must cover the slower one.
  const ceilings = [...renderJob.matchAll(/--max-time (\d+)/g)].map((match) => Number(match[1]));
  assert.ok(ceilings.length >= 1, "the render probe must bound its own curl call");
  for (const ceiling of ceilings) {
    assert.ok(ceiling >= 90, `render probe ceiling ${ceiling}s cannot outlast a cold start`);
  }

  // Two services x (3 attempts x 90 s probe + 2 x 20 s backoff) ~= 620 s.
  const jobTimeout = Number(/timeout-minutes: (\d+)/.exec(renderJob)?.[1]);
  assert.ok(jobTimeout >= 12, `job timeout ${jobTimeout}min cannot fit the retry budget`);
});

test("Render keep-alive documents its cadence as a canary, not a warmer", async () => {
  const source = await readWorkflow();
  assert.match(source, /- cron: '0 \*\/4 \* \* \*'/, "the free-tier cadence stays every 4 hours");
  assert.match(source, /Render Free idles a web service after ~15/);
  assert.match(source, /cannot keep the backend or the AI service warm/);
  assert.match(source, /Real[\s\S]*?visitor traffic[\s\S]*?is what[\s\S]*?keeps cold starts rare/);
});

test("Supabase keep-alive probe predicates enforce all live contracts in-process", async () => {
  const source = await readWorkflow();
  const supabaseJob = getSupabaseJob(source);
  const sqlFilter = extractFilter(getSupabaseStep(supabaseJob, "Execute Active PostgreSQL Query via Supabase API", "Ping Supabase REST Gateway"), "sql_success");
  const restFilter = extractFilter(getSupabaseStep(supabaseJob, "Ping Supabase REST Gateway", "Ping Supabase Auth Health"), "rest_success");
  const authFilter = extractFilter(getSupabaseStep(supabaseJob, "Ping Supabase Auth Health", "Verify Inactivity Reset"), "auth_success");

  // The kept-alive oracle must both accept the documented 2xx bodies and reject
  // every malformed, extra-field or multi-root response.
  const accepts = (status, filter, body) => /^2\d{2}$/.test(String(status)) && runJqFilter(filter, body);

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
