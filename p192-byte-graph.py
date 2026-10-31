from pathlib import Path

path = Path("scripts/lib/byte-budgets.mjs")
with path.open("r", encoding="utf-8", newline="") as stream:
    source = stream.read()
nl = "\r\n" if "\r\n" in source else "\n"

insert_at = source.index("export function scriptEntries(")
helper = nl.join([
    "// Add modules explicitly loaded by preloadRunModules before renderResults",
    "// paints the first result. Other dynamic imports remain lazy and do not count.",
    "function firstResultGraph(entries, read, staged) {",
    "  const graph = new Set(moduleGraph(entries, read, staged));",
    '  const uiEntry = [...graph].find((file) => /(^|\\/)sizing\\/ui\\.js$/.test(file));',
    "  if (!uiEntry) return graph;",
    "",
    '  const source = read(uiEntry).toString("utf8");',
    '  const start = source.indexOf("function preloadRunModules()");',
    '  const end = source.indexOf("// Live, quiet feedback", start);',
    "  if (start < 0 || end < 0) return graph;",
    "  const loader = source.slice(start, end);",
    "  const roots = [...loader.matchAll(/\\bimport\\s*\\(\\s*[\"']([^\"']+)[\"']\\s*\\)/g)]",
    "    .map((match) => resolveRelative(uiEntry, match[1]))",
    "    .filter((file) => file && staged.has(file));",
    "  for (const root of roots) {",
    "    for (const file of moduleGraph([root], read, staged)) graph.add(file);",
    "  }",
    "  return graph;",
    "}",
    "",
])
source = source[:insert_at] + helper + source[insert_at:]

old = nl.join([
    "  const entries = scriptEntries(html, has);",
    "  const graph = [...moduleGraph(entries, read, has)];",
    "  const graphBytes = sumOrNull(graph);",
    "  const graphSizes = Object.fromEntries(graph.map((f) => [f, size(f)]));",
])
new = nl.join([
    "  const entries = scriptEntries(html, has);",
    "  const graph = [...moduleGraph(entries, read, has)];",
    "  const graphBytes = sumOrNull(graph);",
    "  const firstResultGraphPaths = [...firstResultGraph(entries, read, has)];",
    "  const firstResultBytes = sumOrNull(firstResultGraphPaths);",
    "  const graphSizes = Object.fromEntries(graph.map((f) => [f, size(f)]));",
])
if source.count(old) != 1:
    raise SystemExit("byte graph measurement block was not unique")
source = source.replace(old, new, 1)
old = nl.join([
    '      js_to_first_result: metric("js_to_first_result", graphBytes, {',
    "        files: graph.length,",
    '        note: "the same graph today, because no code path defers work between step 1 and the first result. Measured as its own line so the two diverge the moment something does.",',
    "      }),",
])
new = nl.join([
    '      js_to_first_result: metric("js_to_first_result", firstResultBytes, {',
    "        files: firstResultGraphPaths.length,",
    '        note: "the initial static graph plus the modules preloadRunModules loads before renderResults paints; other dynamic imports stay deferred.",',
    "      }),",
])
if source.count(old) != 1:
    raise SystemExit("first-result metric block was not unique")
source = source.replace(old, new, 1)
with path.open("w", encoding="utf-8", newline="") as stream:
    stream.write(source)

test_path = Path("tests/byte-budgets.test.mjs")
with test_path.open("r", encoding="utf-8", newline="") as stream:
    test_source = stream.read()
test_nl = "\r\n" if "\r\n" in test_source else "\n"
anchor = 'test("BUDGET: the registry budget is per country, so the worst country is reported", () => {'
if test_source.count(anchor) != 1:
    raise SystemExit("byte-budget test insertion anchor was not unique")
test_lines = [
    'test("BUDGET: first-result JS includes modules awaited by the result loader", () => {',
    "  const { metrics } = measureStagedBuild(",
    "    fixture({",
    '      "assets/js/sizing/ui.js": [',
    '        \'import { engine } from "./engine.js";\',',
    '        \'function preloadRunModules() { return Promise.all([import("./charts.js?v=20261022h"), import("./frontier-chart.js?v=20261022h")]); }\',',
    '        "async function renderResults() { await preloadRunModules(); }",',
    '        "// Live, quiet feedback",',
    '      ].join("\\n"),',
    '      "assets/js/sizing/charts.js": \'import { helper } from "../shared/helper.js"; export const charts = helper;\',',
    '      "assets/js/sizing/frontier-chart.js": "export const frontier = 1;",',
    '      "assets/js/shared/helper.js": "export const helper = 1;",',
    "    }),",
    "  );",
    "  assert.ok(",
    "    metrics.js_to_first_result.files > metrics.js_before_interactive.files,",
    '    "modules that render the first result are counted even when loaded dynamically",',
    "  );",
    "  assert.ok(",
    "    metrics.js_to_first_result.value > metrics.js_before_interactive.value,",
    '    "the first-result reading includes the bytes of awaited result modules",',
    "  );",
    "});",
    "",
]
test_source = test_source.replace(anchor, test_nl.join(test_lines) + test_nl + anchor, 1)
with test_path.open("w", encoding="utf-8", newline="") as stream:
    stream.write(test_source)
