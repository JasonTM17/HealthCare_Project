import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();

// Execute the real TypeScript and its relative runtime imports with the same
// CommonJS transpilation used by the component contract tests.
export function loadTypeScriptModule(path) {
  path = resolve(path instanceof URL ? fileURLToPath(path) : path);
  if (!existsSync(path)) path += ".ts";
  if (cache.has(path)) return cache.get(path).exports;
  const loadedModule = { exports: {} };
  cache.set(path, loadedModule);
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  new Function("require", "module", "exports", compiled.outputText)(
    (name) => name.startsWith(".") ? loadTypeScriptModule(resolve(dirname(path), name)) : require(name),
    loadedModule, loadedModule.exports,
  );
  return loadedModule.exports;
}
