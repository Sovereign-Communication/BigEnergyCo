from pathlib import Path
import re

path = Path("assets/js/sizing/ui.js")
with path.open("r", encoding="utf-8", newline="") as stream:
    source = stream.read()
nl = "\r\n" if "\r\n" in source else "\n"

def remove_once(pattern, label):
    global source
    updated, count = re.subn(pattern, "", source, count=1, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f"expected one {label} block, found {count}")
    source = updated

remove_once(r'import \{\s*drawAutoChart,\s*drawCumCostChart,\s*drawSocChart,\s*drawSocChartForEntry,\s*initCharts,\s*setupChartInteractions,\s*setupZoomButtons,\s*\} from "\./charts\.js\?v=20261022g";\s*', "charts")
remove_once(r'import \{\s*renderFrontier,\s*frontierVerdict,\s*markerOffCurveNote,\s*\} from "\./frontier-chart\.js\?v=20261022g";\s*', "frontier chart")
remove_once(r'import \{\s*rescalePayload,\s*scaleRecord,\s*sameSiteOptions,\s*relocalizeOversizeCallout,\s*\} from "\./rescale\.js\?v=20261022g";\s*', "rescale")
remove_once(r'import \{ coldCapacityScale, cycleLifeForDoD \} from "\./engine\.js\?v=20261022g";\s*', "engine")
remove_once(r'// Charts own their own state \(zoom range, cached series\); the controller\s*// injects only the DOM/format/i18n/currency boundary\.\s*initCharts\(\{ \$, el, t, fmt, money \}\);\s*', "eager chart initialization")

anchor = 'import { surplusAnchor, budgetSpanMax } from "./budget-span.js?v=20261022g";'
if source.count(anchor) != 1:
    raise SystemExit("module insertion anchor not unique")
loader_lines = [
    "// Heavy modules used only after a sizing result stay outside the initial UI graph.",
    "let _engine = null;",
    "let _charts = null;",
    "let _frontierChart = null;",
    "let _rescale = null;",
    "let _runModulesPromise = null;",
    "let _chartsInitialized = false;",
    "",
    "function preloadRunModules() {",
    "  if (!_runModulesPromise) {",
    "    _runModulesPromise = Promise.all([",
    '      import("./engine.js?v=20261022g"),',
    '      import("./charts.js?v=20261022g"),',
    '      import("./frontier-chart.js?v=20261022g"),',
    '      import("./rescale.js?v=20261022g"),',
    "    ])",
    "      .then(([engine, charts, frontierChart, rescale]) => {",
    "        _engine = engine;",
    "        _charts = charts;",
    "        _frontierChart = frontierChart;",
    "        _rescale = rescale;",
    "        if (!_chartsInitialized) {",
    "          _chartsInitialized = true;",
    "          _charts.initCharts({ $, el, t, fmt, money });",
    "          _charts.setupChartInteractions();",
    "          _charts.setupZoomButtons();",
    "        }",
    "      })",
    "      .catch((error) => {",
    "        _runModulesPromise = null;",
    "        throw error;",
    "      });",
    "  }",
    "  return _runModulesPromise;",
    "}",
]
source = source.replace(anchor, anchor + nl + nl.join(loader_lines), 1)

for old, new in [
    ("sameSiteOptions(lastRunInput, inp)", "_rescale.sameSiteOptions(lastRunInput, inp)"),
    ("return relocalizeOversizeCallout(text, money);", "return _rescale.relocalizeOversizeCallout(text, money);"),
    ("coldCapacityScale(", "_engine.coldCapacityScale("),
    ("cycleLifeForDoD(", "_engine.cycleLifeForDoD("),
    ("renderFrontier($(", "_frontierChart.renderFrontier($("),
    ("frontierVerdict(", "_frontierChart.frontierVerdict("),
    ("markerOffCurveNote(", "_frontierChart.markerOffCurveNote("),
    ("drawSocChartForEntry(", "_charts.drawSocChartForEntry("),
    ("drawAutoChart(", "_charts.drawAutoChart("),
    ("drawSocChart(", "_charts.drawSocChart("),
    ("drawCumCostChart(", "_charts.drawCumCostChart("),
]:
    source = source.replace(old, new)

source = source.replace(
    "function renderResults(p) {",
    "async function renderResults(p) {" + nl + "  await preloadRunModules();",
    1,
)
source = source.replace(
    "function refreshSelectionOutputs(p) {" + nl + "  if (!p) return;",
    "async function refreshSelectionOutputs(p) {" + nl + "  if (!p) return;" + nl + "  await preloadRunModules();",
    1,
)
source = source.replace(
    "    setupPwaControls();" + nl + "    setupChartInteractions();",
    "    setupPwaControls();",
    1,
)
source = source.replace(
    "    // Chart zoom buttons: wiring moved to charts.js (single owner)." + nl + "    setupZoomButtons();" + nl,
    "",
    1,
)

if "initCharts(" in source and "_charts.initCharts(" not in source:
    raise SystemExit("unexpected remaining eager chart initialization")
if re.search(r'(?m)^import .* from ["\']\\./(charts|frontier-chart|rescale|engine)\\.js', source):
    raise SystemExit("static post-run module import remains")
with path.open("w", encoding="utf-8", newline="") as stream:
    stream.write(source)
