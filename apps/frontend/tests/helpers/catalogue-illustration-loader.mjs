import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

export function loadCatalogueIllustration() {
  const source = readFileSync(new URL("../../lib/catalogue-illustration.ts", import.meta.url), "utf8");
  const identity = JSON.parse(readFileSync(new URL("../../lib/catalogue-illustration.json", import.meta.url), "utf8"));
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports, require: (name) => {
    if (name === "./catalogue-illustration.json") return identity;
    throw new Error(`Unexpected catalogue dependency: ${name}`);
  } });
  return compiledModule.exports;
}
