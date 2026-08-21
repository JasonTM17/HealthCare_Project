import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readRepositoryFile = (relativePath) => readFile(new URL(`../../../${relativePath}`, import.meta.url), "utf8");

test("clinical local verifier binds confirmation and terminal status to the same appointment", async () => {
  const verifier = await readRepositoryFile("scripts/verify-local-mvp.ps1");

  assert.match(verifier, /referenceId -eq \$confirmed\.id/);
  assert.match(verifier, /eventType -eq "APPOINTMENT_CONFIRMED"/);
  assert.match(verifier, /function Resolve-HospitalTimeZone/);
  assert.match(verifier, /SE Asia Standard Time/);
  assert.match(verifier, /Asia\/Ho_Chi_Minh/);
  assert.match(
    verifier,
    /\$completedAppointmentViews = @\([\s\S]*?\$ApiBaseUrl\/patient\/appointments\?size=100[\s\S]*?\$ApiBaseUrl\/doctor\/appointments\?date=\$selectedDate&size=100[\s\S]*?\$ApiBaseUrl\/admin\/appointments\?date=\$selectedDate&size=100/,
  );
  assert.match(verifier, /completedAppointment\.id -ne \$doctorAppointment\.id/);
  assert.match(verifier, /completedAppointment\.status -ne "COMPLETED"/);
  assert.match(verifier, /clinical:check-in\+in-progress\+record\+completed\+own-patient-visible/);
});

test("clinical verifier documentation remains scoped to API evidence", async () => {
  const [runbook, plan] = await Promise.all([
    readRepositoryFile("docs/LOCAL_RUNBOOK.md"),
    readRepositoryFile("docs/PROJECT_PLAN.md"),
  ]);

  assert.match(runbook, /API-level same-day clinical lifecycle/);
  assert.match(plan, /API counterparts of steps 6 through 12/);
  assert.doesNotMatch(plan, /prove steps 6 through 12/);
});
