import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const source = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;

async function dashboard({ ai = { content: [], page: 0, size: 1, hasMore: false }, payments = { totalElements: 7 }, questions = [] } = {}) {
  const hooks = [];
  let cursor = 0;
  const effects = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value) => { hooks[index] = value; }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useCallback(callback) { cursor++; return callback; },
    useEffect(effect) { cursor++; effects.push(effect); },
  };
  const api = Object.fromEntries([
    "adminListAppointments", "adminListArticles", "adminListBranches", "adminListDoctors",
    "adminListFaqs", "adminListJobApplications", "adminListPackages", "adminListServices",
    "adminListSpecialties", "adminListUsers",
  ].map((name) => [name, async () => ({ totalElements: 12 })]));
  Object.assign(api, {
    adminListPayments: async () => payments,
    adminListHealthQuestions: async () => questions,
    fetchAdminAiContentReviews: async () => ai,
  });
  const modules = {
    react, "react/jsx-runtime": require("react/jsx-runtime"),
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "../../lib/api-client": api,
    "./_components/AdminState": { __esModule: true, default: () => null },
    "../../components/charts/AdminAppointmentsChart": { __esModule: true, default: () => null },
    "./_lib/errors": { describeAdminError: () => ({ description: "Không thể tải dữ liệu" }) },
    "../../components/UiIcon": { __esModule: true, default: () => null },
  };
  const runtime = { exports: {} };
  vm.runInNewContext(compiled, { module: runtime, exports: runtime.exports,
    require(name) { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; },
  });
  runtime.exports.default();
  effects.forEach((effect) => effect());
  await new Promise((resolve) => setImmediate(resolve));
  cursor = 0;
  return renderToStaticMarkup(runtime.exports.default());
}

test("dashboard renders the real AI slice without a totalElements field", async () => {
  const html = await dashboard();
  assert.match(html, /Điều hành bệnh viện/);
  assert.match(html, /Nội dung AI chờ duyệt/);
  assert.match(html, /Không có việc chờ/);
});

test("AI slice with hasMore presents a lower bound, never a fabricated exact total", async () => {
  const html = await dashboard({ ai: { content: [{}], page: 0, size: 1, hasMore: true } });
  assert.match(html, />1\+</);
  assert.match(html, /Có thêm bản ghi/);
});

test("missing or invalid totals degrade only their card and do not become zero", async () => {
  for (const totalElements of [undefined, -1, NaN, "7"]) {
    const html = await dashboard({ payments: { totalElements } });
    assert.match(html, /Điều hành bệnh viện/);
    assert.match(html, /Chưa thể xác định số lượng/);
    assert.match(html, /Thanh toán chờ đối soát/);
  }
});

test("bounded question lists show truncation and malformed AI slices stay visibly unavailable", async () => {
  const html = await dashboard({ questions: Array.from({ length: 100 }, () => ({})), ai: { content: [] } });
  assert.match(html, />100\+</);
  assert.match(html, /Chưa thể xác định số lượng/);
});
