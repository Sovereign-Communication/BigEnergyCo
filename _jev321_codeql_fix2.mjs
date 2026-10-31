import { readFileSync, writeFileSync } from "node:fs";

const file = "C:/tmp/be-jev-burndown-20261026/tests/mutation-lock.test.mjs";
const raw = readFileSync(file, "utf8");
const lines = raw.split("\r\n");

// Sanity: confirm the expected anchors before touching anything.
const expect = (idx, needle, label) => {
  if (!lines[idx].includes(needle)) {
    console.error(`ABORT ${label}: line ${idx + 1} is:\n  ${lines[idx]}`);
    process.exit(1);
  }
};

expect(123, "const code = [", "array open");
expect(124, "appendFileSync } from", "import line");
expect(125, "JSON.stringify(lockModule)", "tainted lockModule");
expect(131, "].join(", "array close");
expect(135, '"-e", code', "spawn args");

// The child source must be a fixed literal; every value moves to argv.
const newCodeBlock = [
  '        const code = [',
  '          "import { appendFileSync } from \'node:fs\';",',
  '          "const { withMutationLock } = await import(process.argv[1]);",',
  '          "const eventsPath = process.argv[2];",',
  '          "const name = process.argv[3];",',
  '          "const lockRoot = process.argv[4];",',
  '          "await withMutationLock(async () => {",',
  '          "  appendFileSync(eventsPath, name + \':start\\\\n\');",',
  '          "  await new Promise((resolve) => setTimeout(resolve, 100));",',
  '          "  appendFileSync(eventsPath, name + \':end\\\\n\');",',
  '          "}, lockRoot, { timeoutMs: 3000, stepMs: 2 });",',
  '        ].join("\\n");',
];

const newSpawnArgs = [
  '            [',
  '              "--input-type=module",',
  '              "-e",',
  '              code,',
  '              lockModule,',
  '              eventsPath,',
  '              name,',
  '              root,',
  '            ],',
];

// Splice from the bottom up so earlier indices stay valid.
const out = lines.slice(0, 123)
  .concat(newCodeBlock)
  .concat(lines.slice(132, 135))
  .concat(newSpawnArgs)
  .concat(lines.slice(136));

writeFileSync(file, out.join("\r\n"), "utf8");

const check = readFileSync(file, "utf8");
const bareLf = (check.match(/(?<!\r)\n/g) || []).length;
const tainted = (check.match(/JSON\.stringify\((lockModule|eventsPath|root)\)/g) || []).length;
console.log("bare LF remaining:", bareLf);
console.log("tainted code interpolations remaining:", tainted);
