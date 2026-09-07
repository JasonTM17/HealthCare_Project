import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);
const pagePath = new URL("../app/doctor/care-plans/page.tsx", import.meta.url);

test("doctor care plan client exposes the editable lifecycle endpoints", async () => {
  const source = await readFile(apiClientPath, "utf8");

  assert.match(source, /export async function updateDoctorCarePlan/);
  assert.match(source, /`\/doctor\/care-plans\/\$\{encodeURIComponent\(id\)\}`,\s*\{\s*method:\s*"PUT"/s);
  assert.match(source, /export async function completeDoctorCarePlanItem/);
  assert.match(source, /`\/doctor\/care-plans\/items\/\$\{encodeURIComponent\(id\)\}\/complete`,\s*\{\s*method:\s*"POST"/s);
  assert.match(source, /export async function cancelDoctorCarePlanItem/);
  assert.match(source, /`\/doctor\/care-plans\/items\/\$\{encodeURIComponent\(id\)\}\/cancel`,\s*\{\s*method:\s*"POST"/s);
  assert.match(source, /export async function deleteDoctorCarePlan/);
  assert.match(source, /`\/doctor\/care-plans\/\$\{encodeURIComponent\(id\)\}`,\s*\{\s*method:\s*"DELETE"/s);
});

test("doctor care plan page wires editing, item actions and safe portal states", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /updateDoctorCarePlan/);
  assert.match(source, /completeDoctorCarePlanItem/);
  assert.match(source, /cancelDoctorCarePlanItem/);
  assert.match(source, /deleteDoctorCarePlan/);
  assert.match(source, /type="datetime-local"/);
  assert.match(source, /beginEdit\(plan\)/);
  assert.match(source, /saveEdit/);
  assert.match(source, /summarizePlanStatus/);
  assert.match(source, /window\.confirm\("Hủy mục chăm sóc này\?"\)/);
  assert.match(source, /window\.confirm\("Xóa kế hoạch chăm sóc này\?"\)/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /LoginRequiredState/);
  assert.match(source, /ForbiddenState/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|Authorization|Bearer|accessToken|refreshToken|tokenType/);
});
