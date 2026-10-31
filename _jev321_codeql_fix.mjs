import { readFileSync, writeFileSync } from "node:fs";

const file = "C:/tmp/be-jev-burndown-20261026/tests/mutation-lock.test.mjs";

const oldLf = [
  '      const code = `import { withMutationLock } from ${JSON.stringify(lockModule)}; await withMutationLock(() => console.log("borrowed"), ${JSON.stringify(root)});`;',
  "      const output = execFileSync(",
  "        process.execPath,",
  '        ["--input-type=module", "-e", code],',
  '        { encoding: "utf8" },',
  "      );",
].join("\n");

const newLf = [
  "      const code =",
  '        "const { withMutationLock } = await import(process.argv[1]); await withMutationLock(() => console.log(\'borrowed\'), process.argv[2]);";',
  "      const output = execFileSync(",
  "        process.execPath,",
  '        ["--input-type=module", "-e", code, lockModule, root],',
  '        { encoding: "utf8" },',
  "      );",
].join("\n");

const toCrlf = (s) => s.split("\n").join("\r\n");
const text = readFileSync(file, "utf8");
const oldCrlf = toCrlf(oldLf);

const occurrences = text.split(oldCrlf).length - 1;
if (occurrences !== 1) {
  console.error(`ABORT: expected exactly 1 match, found ${occurrences}`);
  process.exit(1);
}

const next = text.replace(oldCrlf, toCrlf(newLf));
writeFileSync(file, next, "utf8");

const check = readFileSync(file, "utf8");
const bareLf = (check.match(/(?<!\r)\n/g) || []).length;
console.log("replaced: 1");
console.log("bare LF remaining:", bareLf);
console.log("tainted interpolation remaining:", check.includes("JSON.stringify(lockModule)"));
