import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const requireFromTest = createRequire(import.meta.url);
const ts = requireFromTest("typescript");
const { createElement, isValidElement } = requireFromTest("react");
const { renderToStaticMarkup } = requireFromTest("react-dom/server");
const source = readFileSync(new URL("../app/admin/consultations/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const apiSource = readFileSync(new URL("../lib/api-client.ts", import.meta.url), "utf8");
const apiTree = ts.createSourceFile("api-client.ts", apiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const fetchAllDeclaration = apiTree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "fetchAllContent");
assert.ok(fetchAllDeclaration, "use the actual shared catalog pagination helper");
const fetchAllCode = ts.transpileModule(fetchAllDeclaration.getText(apiTree), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const fetchAllModule = { exports: {} };
vm.runInNewContext(fetchAllCode, { module: fetchAllModule, exports: fetchAllModule.exports });

const DOCTOR_ONE = "00000000-0000-4000-8000-000000000001";
const DOCTOR_TWO = "00000000-0000-4000-8000-000000000002";
const BRANCH_ONE = "00000000-0000-4000-8000-000000000011";
const BRANCH_TWO = "00000000-0000-4000-8000-000000000012";
const DOCTORS = [
  { id: DOCTOR_ONE, fullName: "Nguyễn Minh An", slug: "nguyen-minh-an-co-so-bac", branchIds: [BRANCH_ONE], active: true },
  { id: DOCTOR_TWO, fullName: "Nguyễn Minh An", slug: "nguyen-minh-an-co-so-nam", branchIds: [BRANCH_TWO], active: true },
  { id: "inactive-doctor", fullName: "Bác sĩ ngừng hoạt động", slug: "inactive", branchIds: [BRANCH_ONE], active: false },
];
const BRANCHES = [{ id: BRANCH_ONE, name: "Cơ sở Bắc" }, { id: BRANCH_TWO, name: "Cơ sở Nam" }];
const NOW = Date.parse("2026-10-01T07:30:00Z");
class FixedDate extends Date {
  constructor(...values) { super(...(values.length ? values : [NOW])); }
  static now() { return NOW; }
}
const checkpoint = () => new Promise((resolve) => setImmediate(resolve));
const sameDependencies = (left, right) => left?.length === right?.length && left.every((value, index) => Object.is(value, right[index]));

function nodes(element) {
  if (Array.isArray(element)) return [...element].flatMap(nodes);
  if (!isValidElement(element)) return [];
  return [element, ...nodes(element.props.children)];
}
function text(element) {
  if (Array.isArray(element)) return [...element].map(text).join("");
  if (isValidElement(element)) return text(element.props.children);
  return typeof element === "string" || typeof element === "number" ? String(element) : "";
}
function queueItem(index, overdue = false) {
  return {
    threadId: `synthetic-channel-${index}`,
    specialtySlug: "cardiology", status: "WAITING_FOR_DOCTOR", assignmentRole: "ASSIGNED_DOCTOR",
    firstResponseDueAt: overdue ? "2026-09-30T00:00:00Z" : "2026-10-02T00:00:00Z",
    firstRespondedAt: null, consultationOpenUntil: "2026-10-12T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
  };
}

function createHarness({ doctors = DOCTORS, branches = BRANCHES, branchFailure = false, doctorFailure = false,
  pages = [Array.from({ length: 20 }, (_, index) => queueItem(index)), [queueItem(20, true)]] } = {}) {
  const hooks = [];
  let cursor = 0;
  let dirty = true;
  let current;
  let effects = [];
  const calls = { doctors: [], branches: [], queue: [], assignments: [] };
  const session = { user: { id: "synthetic-admin", roles: ["ADMIN"] } };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === "function" ? initial() : initial };
      return [hooks[index].value, (next) => {
        hooks[index].value = typeof next === "function" ? next(hooks[index].value) : next;
        dirty = true;
      }];
    },
    useMemo(factory, dependencies) {
      const index = cursor++;
      if (!sameDependencies(hooks[index]?.dependencies, dependencies)) hooks[index] = { dependencies, value: factory() };
      return hooks[index].value;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!sameDependencies(hooks[index]?.dependencies, dependencies)) {
        const cleanup = hooks[index]?.cleanup;
        hooks[index] = { dependencies };
        effects.push(() => { cleanup?.(); hooks[index].cleanup = effect(); });
      }
    },
  };
  function pageOf(rows, page, size) {
    return { content: rows.slice(page * size, (page + 1) * size), totalPages: Math.ceil(rows.length / size), totalElements: rows.length };
  }
  const api = {
    ApiError: class extends Error {},
    hasRole: (user, role) => user.roles.includes(role),
    fetchAllContent: fetchAllModule.exports.fetchAllContent,
    async adminListDoctors(page, size) {
      calls.doctors.push({ page, size });
      if (doctorFailure) throw new Error("Synthetic doctor catalog failure");
      return pageOf(doctors, page, size);
    },
    async fetchBranches(page, size) {
      calls.branches.push({ page, size });
      if (branchFailure) throw new Error("Synthetic branch catalog failure");
      return pageOf(branches, page, size);
    },
    async fetchAdminConsultationQueue(options) {
      calls.queue.push({ ...options });
      return pages[options.page] ?? [];
    },
    async assignAdminConsultation(threadId, doctorId) { calls.assignments.push({ threadId, doctorId }); },
  };
  const modules = {
    react,
    "react/jsx-runtime": requireFromTest("react/jsx-runtime"),
    "../../../components/PortalStates": Object.fromEntries(["ForbiddenState", "LoadingState", "LoginRequiredState"].map((name) => [name, (props) => createElement("p", null, props.label ?? props.title ?? name)])),
    "../../../components/useAuthSession": { useAuthSession: () => session },
    "../../../lib/api-client": api,
    "../../../lib/present-api-error": { presentApiError: () => "Lỗi mô phỏng" },
    "../../../lib/datetime": { formatDateTime: (value) => value },
  };
  const runtimeModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: runtimeModule, exports: runtimeModule.exports, Date: FixedDate,
    require(specifier) { assert.ok(specifier in modules, `unexpected dependency ${specifier}`); return modules[specifier]; },
  });
  function render() {
    cursor = 0;
    dirty = false;
    current = runtimeModule.exports.default();
    const pending = effects;
    effects = [];
    pending.forEach((effect) => effect());
  }
  return {
    calls,
    async flush() {
      // Run actual page effects and state callbacks until controlled promise
      // settlements stabilize. No browser, timer delay or real API writes.
      for (let pass = 0; pass < 8; pass++) {
        if (dirty) render();
        await checkpoint();
        if (!dirty && effects.length === 0) return this.output();
      }
      throw new Error("The source page did not settle");
    },
    output() {
      const elements = nodes(current);
      return {
        html: renderToStaticMarkup(current), text: text(current), elements,
        button(label) { return elements.find((node) => node.type === "button" && text(node) === label); },
        select(id) { return elements.find((node) => node.type === "select" && node.props.id === id); },
        options(id = "consultation-assignment-0") {
          return nodes(this.select(id)).filter((node) => node.type === "option" && node.props.value !== "")
            .map((node) => ({ value: node.props.value, label: text(node) }));
        },
      };
    },
  };
}

test("same-name doctors use distinct branch labels and submit their original eligible IDs", async () => {
  const harness = createHarness();
  let output = await harness.flush();
  const options = output.options();
  assert.deepEqual(options.map((option) => option.value), [DOCTOR_ONE, DOCTOR_TWO]);
  assert.ok(options[0].label.includes("Cơ sở Bắc"));
  assert.ok(options[1].label.includes("Cơ sở Nam"));
  assert.equal(new Set(options.map((option) => option.label)).size, 2);
  assert.ok(options.every((option) => !option.label.includes(option.value)), "UUIDs remain values, not visible identities");
  assert.equal(harness.calls.branches.length, 1, "20 controls share one catalog lookup");
  output.select("consultation-assignment-0").props.onChange({ target: { value: DOCTOR_TWO } });
  output = await harness.flush();
  assert.equal(output.button("Cập nhật phân công").props.disabled, false);
  output.button("Cập nhật phân công").props.onClick();
  await harness.flush();
  assert.deepEqual(harness.calls.assignments, [{ threadId: "synthetic-channel-0", doctorId: DOCTOR_TWO }]);
});

test("same-name doctors at the same branch use their existing public slugs as collision fallback", async () => {
  const doctors = DOCTORS.slice(0, 2).map((doctor) => ({ ...doctor, branchIds: [BRANCH_ONE] }));
  const output = await createHarness({ doctors }).flush();
  const options = output.options();
  assert.equal(new Set(options.map((option) => option.label)).size, 2);
  for (let index = 0; index < options.length; index++) {
    assert.ok(options[index].label.includes("Cơ sở Bắc"));
    assert.ok(options[index].label.includes(doctors[index].slug));
    assert.ok(!options[index].label.includes(doctors[index].id));
  }
});

test("missing branch catalog data stays honest without dropping eligible doctors", async () => {
  const harness = createHarness({ branches: [] });
  const output = await harness.flush();
  const options = output.options();
  assert.deepEqual(options.map((option) => option.value), [DOCTOR_ONE, DOCTOR_TWO]);
  assert.ok(options.every((option) => option.label.includes("Cơ sở chưa cập nhật")));
  assert.ok(options.every((option, index) => option.label.includes(DOCTORS[index].slug)));
  assert.equal(output.select("consultation-assignment-0").props.disabled, false);
  assert.equal(harness.calls.branches.length, 1);
});

test("branch lookup failure has honest fallback while original selection and assignment remain available", async () => {
  const harness = createHarness({ branchFailure: true });
  let output = await harness.flush();
  assert.ok(output.text.includes("Chưa tải được tên cơ sở"));
  const options = output.options();
  assert.equal(new Set(options.map((option) => option.label)).size, 2);
  assert.ok(options.every((option, index) => option.label.includes(DOCTORS[index].slug)));
  assert.equal(output.select("consultation-assignment-0").props.disabled, false);
  output.select("consultation-assignment-0").props.onChange({ target: { value: DOCTOR_ONE } });
  output = await harness.flush();
  output.button("Cập nhật phân công").props.onClick();
  await harness.flush();
  assert.equal(harness.calls.assignments[0].doctorId, DOCTOR_ONE);
});

test("page-one SLA counts and filter labels state their actual page scope", async () => {
  const output = await createHarness().flush();
  assert.ok(output.text.includes("0 kênh quá SLA trên trang này"));
  assert.ok(!output.text.includes("toàn hàng đợi"));
  const due = nodes(output.select("consultation-sla-filter")).find((node) => node.type === "option" && node.props.value === "DUE");
  assert.equal(text(due), "Chỉ kênh quá SLA trên trang này");
  assert.ok(output.text.includes("Lọc trang hiện tại"));
});

test("filtered-empty page one preserves navigation to overdue page two and a scoped reset", async () => {
  const harness = createHarness();
  let output = await harness.flush();
  output.select("consultation-sla-filter").props.onChange({ target: { value: "DUE" } });
  output = await harness.flush();
  assert.ok(output.text.includes("Trang này không có kênh phù hợp"));
  assert.ok(output.button("Xem tất cả trên trang này"));
  assert.equal(output.button("Sau").props.disabled, false);
  assert.equal(output.elements.filter((node) => node.type === "article").length, 0);
  output.button("Sau").props.onClick();
  output = await harness.flush();
  assert.ok(output.text.includes("Trang 2"));
  assert.ok(output.text.includes("1 kênh quá SLA trên trang này"));
  assert.equal(output.elements.filter((node) => node.type === "article").length, 1);
  assert.equal(output.button("Sau").props.disabled, true);
  assert.equal(output.button("Trước").props.disabled, false);
  assert.equal(harness.calls.branches.length, 1, "pagination does not reload the shared display catalog");
  assert.deepEqual(harness.calls.queue.map((call) => call.page), [0, 1]);
  const reset = output.elements.find((node) => node.type === "button" && text(node).startsWith("Xóa bộ lọc trang này"));
  assert.ok(reset);
  reset.props.onClick();
  output = await harness.flush();
  assert.equal(output.select("consultation-sla-filter").props.value, "ALL");
});

test("failed eligible-doctor loading retains the existing disabled assignment guard", async () => {
  const output = await createHarness({ doctorFailure: true }).flush();
  assert.ok(output.text.includes("Chưa tải được danh sách bác sĩ đủ quyền"));
  assert.equal(output.select("consultation-assignment-0").props.disabled, true);
  assert.equal(output.button("Cập nhật phân công").props.disabled, true);
  assert.equal(output.options().length, 0);
});
