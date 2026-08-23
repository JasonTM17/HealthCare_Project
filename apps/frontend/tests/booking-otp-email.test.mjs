import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const bookingModalPath = new URL("../components/BookingModal.tsx", import.meta.url);

function loadFunctions(source, names) {
  const sourceFile = ts.createSourceFile(
    "BookingModal.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declarations = names.map((name) => {
    const declaration = sourceFile.statements.find(
      (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
    );
    assert.ok(declaration, `${name} must exist in BookingModal`);
    return declaration.getText(sourceFile).replace(/^export\s+/, "");
  });
  const exportsSource = names.map((name) => `${name},`).join("\n");
  const compiled = ts.transpileModule(
    `${declarations.join("\n")}\nmodule.exports = {${exportsSource}};`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

test("booking requires a valid email and identifies the masked OTP destination", async () => {
  const source = await readFile(bookingModalPath, "utf8");
  const { isValidBookingEmail, maskEmail } = loadFunctions(source, [
    "isValidBookingEmail",
    "maskEmail",
  ]);

  assert.equal(isValidBookingEmail(" patient@example.com "), true);
  assert.equal(isValidBookingEmail("patient.example.com"), false);
  assert.equal(isValidBookingEmail("patient@localhost"), false);
  assert.equal(isValidBookingEmail(""), false);
  assert.equal(isValidBookingEmail(`${"a".repeat(310)}@example.com`), false);

  const masked = maskEmail("patient@example.com");
  assert.match(masked, /^pa\*+@example\.com$/);
  assert.notEqual(masked, "patient@example.com");

  assert.match(source, /const normalizedEmail = email\.trim\(\)/);
  assert.match(source, /if \(!normalizedEmail\)/);
  assert.match(source, /if \(!isValidBookingEmail\(normalizedEmail\)\)/);
  assert.match(source, /email: normalizedEmail/);
  assert.doesNotMatch(source, /email: email\.trim\(\) \|\| undefined/);
  assert.match(source, /id="booking-email"[\s\S]{0,260}required/);
  assert.match(source, /id="booking-email"[\s\S]{0,320}maxLength=\{320\}/);
  assert.match(source, /Mã OTP[\s\S]{0,160}email[\s\S]{0,160}maskEmail\(email\)/);
});

test("booking keeps OTP transient and preserves submit, error, and expiry guards", async () => {
  const source = await readFile(bookingModalPath, "utf8");

  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage)\b/);
  assert.doesNotMatch(
    source,
    /(?:searchParams|URLSearchParams|router\.(?:push|replace)|history\.)[\s\S]{0,100}otp/i,
  );
  assert.match(source, /const \[otpCode, setOtpCode\] = useState<string>\(""\)/);
  assert.match(source, /disabled=\{holdExpired \|\| otpExpired \|\| isSubmitting\}/);
  assert.match(source, /disabled=\{isSubmitting \|\| holdExpired \|\| otpExpired\}/);
  assert.match(source, /aria-live="assertive"[\s\S]{0,120}role="alert"/);
  assert.match(source, /isSubmitting \? "Đang xác nhận\.\.\."/);
  assert.match(source, /OTP còn hiệu lực/);
});
