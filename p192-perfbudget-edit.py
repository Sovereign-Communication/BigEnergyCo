from pathlib import Path

path = Path("tests/perf-budget.test.mjs")
with path.open("r", encoding="utf-8", newline="") as stream:
    source = stream.read()
nl = "\r\n" if "\r\n" in source else "\n"

start = source.index("// A budget whose subject set is maintained by hand measures nothing.")
end = source.index("// Static edges only.", start)
graph_comment = nl.join([
    "// A budget whose subject set is maintained by hand measures nothing. The",
    "// eager graph is derived from index.html script roots and the module worker,",
    "// following static imports only. Modules required just before the first",
    "// result are measured separately by the js_to_first_result budget.",
    "",
])
source = source[:start] + graph_comment + source[end:]

start = source.index("  // What changed on the same pass, with the number left at 895,000:")
end = source.index("  // The owner-approved +2 KB allowance", start)
history_comment = nl.join([
    "  // The eager graph and the first-result graph intentionally have different",
    "  // scopes. The former measures code needed before the page responds; the",
    "  // latter also follows the result modules preloadRunModules awaits before",
    "  // renderResults paints. Both readings are derived from staged files.",
    "",
])
source = source[:start] + history_comment + source[end:]

source = source.replace(
    '    "assets/js/sizing/charts.js",' + nl,
    "",
    1,
)
old = '    ["assets/js/sizing/profiles.js", "run.js imports it dynamically"],' + nl
new = old + nl.join([
    '    ["assets/js/sizing/charts.js", "preloadRunModules loads it for a result"],',
    '    ["assets/js/sizing/frontier-chart.js", "preloadRunModules loads it for a result"],',
    '    ["assets/js/sizing/rescale.js", "preloadRunModules loads it for a result"],',
    "",
])
if source.count(old) != 1:
    raise SystemExit("lazy module list anchor not unique")
source = source.replace(old, new, 1)
source = source.replace(
    "bytes belong back in this budget",
    "bytes belong in the first-result budget",
    1,
)
source = source.replace("eagerNames.size >= 39", "eagerNames.size >= 35", 1)
with path.open("w", encoding="utf-8", newline="") as stream:
    stream.write(source)
