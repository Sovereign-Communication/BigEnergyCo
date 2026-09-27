// Plan §8 P0.4 / §3.1: the compressed byte and request budgets, measured on the
// staged, brotli-compressed build, and ratcheted against the last declared
// baseline.
//
// Three things this module is careful about, because each one is a way a
// budget gate can lie by accident:
//
//   1. SCOPE. "JavaScript to the first result" is the transitive module graph a
//      browser must fetch to make step 1 interactive, not the entry file. The
//      registry budget is per country, so the reading is the WORST country, not
//      an average and not whichever sorts first.
//   2. THE PLAN OWNS THE NUMBERS. `BYTE_BUDGET_LIMITS` is §3.1 verbatim. §3.1
//      says a physically unreachable limit may be relaxed "by measured evidence
//      plus an amendment", and the amendment lives in the plan. Nothing here
//      may widen a limit; the gate's job is to keep the breach visible.
//   3. P0.4 RATCHETS, IT DOES NOT ENFORCE ABSOLUTELY. §3.2 makes these gates
//      regression-blocking from P0 and absolute only from P6 (/next/) and P8
//      (all). A reading already over its limit is reported; only getting worse
//      against the declared baseline is a failure.
//
// The input is a staged build described as data — a file list and a reader —
// so the whole thing is testable without a filesystem or a compressor on disk.
import { brotliCompressSync, constants } from "node:zlib";

const KB = 1024;

// §3.1, verbatim. Do not edit: relax a limit in the plan, through an
// amendment, and let this read the new value.
export const BYTE_BUDGET_LIMITS = {
  home_document: 30 * KB,
  css_total: 20 * KB,
  js_before_interactive: 35 * KB,
  js_to_first_result: 200 * KB,
  locale_strings: 25 * KB,
  registry_country: 6 * KB,
  requests_before_interaction: 10,
  web_fonts: 0,
  heatmap_initial: 300 * KB,
};

// Brotli output moves a byte or two between compressor versions and across
// platforms. A change smaller than this is noise, and calling it a regression
// trains everyone to ignore the gate.
export const REGRESSION_TOLERANCE_BYTES = 256;

const FONT_EXT = [".woff", ".woff2", ".ttf", ".otf", ".eot"];

/**
 * Read the declared byte-budget baseline out of the ledger.
 *
 * The P0.3d reader skipped a row it could not use, in silence, and the gate went
 * on ratcheting against an older bar while the ledger claimed a newer one. This
 * reader cannot do that: anything it declines to use is counted in `skipped`
 * and the caller prints it.
 *
 * Only a `baseline` row sets the bar. A `gate-run` row carries the metrics of
 * the run that produced it, and it is the newest line in the ledger — if it
 * could set the bar, the gate would compare every run against itself and never
 * fail anything.
 *
 * The bar is per metric, not per row. P0.4 declares several families of metric
 * as its clusters land (byte budgets, then Lighthouse and axe), and a bar read
 * as "whatever the last row said" would stop enforcing the first family the
 * moment the second family's baseline was appended. The ledger is append-only,
 * so scanning forward and letting a later row overwrite a metric makes the
 * newest declared reading of each metric the bar, and leaves a metric a later
 * row says nothing about alone.
 *
 * Returns `{ metrics, source, skipped }`; with no declared baseline, `metrics`
 * is empty and `source` is null, which the ratchet reports as `unmeasured`.
 */
export function readByteBudgetBaseline(ledgerText) {
  const lines = String(ledgerText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const skipped = [];
  const found = { metrics: {}, source: null };
  for (const [i, line] of lines.entries()) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      skipped.push(`line ${i + 1}: not JSON`);
      continue;
    }
    if (row?.kind !== "baseline") continue;
    const recorded = row?.evidence?.metrics;
    const metrics = {};
    if (recorded && typeof recorded === "object" && !Array.isArray(recorded)) {
      for (const [name, m] of Object.entries(recorded)) {
        if (m && typeof m.value === "number" && Number.isFinite(m.value)) {
          metrics[name] = {
            ...m,
            from_ref: row.ref || null,
            from_ts: row.ts || null,
          };
        }
      }
    }
    if (!Object.keys(metrics).length) {
      skipped.push(
        `line ${i + 1}: a baseline row (${row?.ref || "no ref"}) carries no numeric metrics, so it sets no bar`,
      );
      continue;
    }
    for (const [name, m] of Object.entries(metrics)) found.metrics[name] = m;
    found.source = row.ref || null;
  }
  return { ...found, skipped };
}

export function brotliBytes(buf) {
  return brotliCompressSync(buf, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  }).length;
}

const stripQuery = (u) => u.split("?")[0];
const kb = (n) => `${(n / KB).toFixed(1)} KB`;

/**
 * Print a reading in its own unit. §3.1's request line is a count and every
 * other line is bytes, so the unit travels with the value: the first run of
 * this gate printed "0.0 KB" beside "10 req" for a reading of 8, which looks
 * like a budget met by nothing.
 */
export function formatReading(value, unit) {
  if (value === null || value === undefined) return "not measured";
  if (unit === "count") return String(value);
  return kb(value);
}

function resolveRelative(fromFile, target) {
  const clean = stripQuery(target);
  if (/^https?:/i.test(clean)) return null; // another origin: not our file
  if (clean.startsWith("/")) return clean.slice(1);
  const base = fromFile.split("/").slice(0, -1);
  for (const part of clean.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
}

// The resources the home document asks for before a visitor can do anything.
// Same-origin only: a preconnect to a third-party API opens a connection, it
// does not request a staged asset, and counting it would hide a real budget
// problem behind a free line.
function initialRequests(html, read, staged) {
  const refs = new Set();
  // Every matcher here is case-insensitive. HTML tag and attribute names are
  // case-insensitive by spec, and a budget gate that skips an upper-case
  // <SCRIPT> under-counts by precisely what someone wanted out of sight (this
  // is also what CodeQL's high-severity "does not match upper case <SCRIPT>
  // tags" alert was about).
  for (const m of html.matchAll(/<(?:script|link|img)\b[^>]*>/gi)) {
    const tag = m[0];
    if (/rel="(?:preconnect|dns-prefetch)"/i.test(tag)) continue;
    const src = /\bsrc="([^"]+)"/i.exec(tag) || /\bhref="([^"]+)"/i.exec(tag);
    if (!src) continue;
    const rel = resolveRelative("index.html", src[1]);
    if (rel && staged.has(rel)) refs.add(rel);
  }
  return refs.size + 1; // +1: the document itself
}

// Comments are not code, and a graph walk that reads them counts files nobody
// loads. Both comment forms are removed before any import is matched.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

// The transitive ES module graph from a set of entry scripts: what the browser
// must fetch before the module executes, which is before step 1 is interactive.
//
// The specifiers come from two shapes, and BOTH matter:
//
//   from "./x.js"   an import or export with bindings, which is the only place
//                   this appears in a module — and the import LIST may span
//                   many lines, so the clause is matched on its own rather than
//                   as part of a one-line `import ... from` statement. That
//                   mistake was live: assets/js/sizing/ui.js pulls in
//                   shared/i18n.js across six lines, and the old walk never saw
//                   it. It understated the first-result JavaScript by 78.6 KB.
//   import "./x.js"  a side-effect import, which fetches just as surely.
//
// Anything the walk cannot resolve, or that is not a staged file, is dropped —
// so a false positive costs nothing, while a false negative silently shrinks
// the number the gate exists to hold.
function moduleGraph(entries, read, staged) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel) || !staged.has(rel) || !rel.endsWith(".js")) continue;
    seen.add(rel);
    const src = stripComments(read(rel).toString("utf8"));
    const specifiers = [
      ...[...src.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1]),
      ...[...src.matchAll(/\bimport\s*["']([^"']+)["']/g)].map((m) => m[1]),
    ];
    for (const spec of specifiers) {
      const dep = resolveRelative(rel, spec);
      if (dep) queue.push(dep);
    }
  }
  return seen;
}

function scriptEntries(html, staged, from = "index.html") {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)) {
    const rel = resolveRelative(from, m[1]);
    if (rel && staged.has(rel)) out.push(rel);
  }
  return out;
}

/**
 * Measure every §3.1 budget on a staged build described as data.
 * `files` is the staged file list (posix relative paths), `read` returns a
 * Buffer for one of them. Returns `{ metrics }`, one entry per plan budget.
 */
export function measureStagedBuild({ files, read }) {
  const list = [...files];
  const has = new Set(list);
  const bytes = new Map();
  const size = (rel) => {
    if (!bytes.has(rel)) bytes.set(rel, brotliBytes(read(rel)));
    return bytes.get(rel);
  };
  const sumOver = (paths) => paths.reduce((n, p) => n + size(p), 0);
  // An empty set is a real zero only where the plan's budget is about absence
  // (web fonts). Everywhere else a subject that is not in the staged build is
  // `null` — "not measured" — because 0 would satisfy the budget without
  // anything having been read.
  const sumOrNull = (paths) => (paths.length ? sumOver(paths) : null);

  const html = read("index.html").toString("utf8");
  const entries = scriptEntries(html, has);
  const graph = [...moduleGraph(entries, read, has)];
  const graphBytes = sumOrNull(graph);
  const graphSizes = Object.fromEntries(graph.map((f) => [f, size(f)]));

  const css = list.filter((f) => f.endsWith(".css"));
  const fonts = list.filter((f) => FONT_EXT.some((e) => f.endsWith(e)));

  // Strings: the plan's line is per locale, so the reading is the per-locale
  // share. The shipped unit is reported alongside it, because a browser pays
  // the whole file and that number should not be invisible.
  const localeFile = list.find((f) => /(^|\/)locales\.js$/.test(f));
  let localeValue = null;
  let localeFileBytes = null;
  let localeCount = 0;
  if (localeFile) {
    localeFileBytes = size(localeFile);
    const src = read(localeFile).toString("utf8");
    localeCount = [
      ...src.matchAll(/(?:^|[\s,{])"?([a-z]{2}(?:-[A-Z]{2})?)"?\s*:\s*\{/g),
    ].length;
    localeValue = localeCount
      ? Math.round(localeFileBytes / localeCount)
      : localeFileBytes;
  }

  // Registry data, per country. The reading is the worst country: a budget a
  // visitor can breach by choosing a country is not met by an average.
  const byCountry = {};
  for (const f of list.filter((p) => /city-data\/[A-Z]{2}\.json$/.test(p))) {
    const cc = /city-data\/([A-Z]{2})\.json$/.exec(f)[1];
    byCountry[cc] = size(f);
  }
  const worstEntry = Object.entries(byCountry).sort(
    (a, b) => b[1] - a[1],
  )[0] || [null, null];

  // The heatmap's own initial payload: its entry script plus the data it
  // fetches on load. The calculator's home page never fetches this, so it is
  // measured on the page that actually pays for it. The page is found by name
  // rather than by a hard-coded path: `solar-heatmap/index.html` is the real
  // one, and a path that matches nothing once reported a 0-byte payload.
  const heatmapPage = list.find((f) =>
    /(^|\/)[^/]*heatmap[^/]*\/index\.html$/i.test(f),
  );
  let heatmapBytes = null;
  const heatmapParts = [];
  if (heatmapPage) {
    const page = read(heatmapPage).toString("utf8");
    const heatEntries = scriptEntries(page, has, heatmapPage);
    const heatData = [];
    for (const e of heatEntries) {
      heatmapParts.push(e);
      for (const m of read(e)
        .toString("utf8")
        .matchAll(/fetch\(\s*["']([^"']+)["']/g)) {
        // A fetch() URL resolves against the DOCUMENT, not against the script
        // that calls it — unlike an import specifier, which resolves against
        // the importing module. Resolving it against the script resolved
        // `../assets/data/heatmap-grid.json` to `assets/assets/data/…`, found
        // nothing, and quietly dropped the largest file on the page from the
        // reading.
        const rel = resolveRelative(heatmapPage, m[1]);
        if (rel && has.has(rel) && !heatData.includes(rel)) heatData.push(rel);
      }
    }
    for (const d of heatData) heatmapParts.push(d);
    heatmapBytes = sumOrNull(heatmapParts);
  }

  const metric = (name, value, extra = {}) => ({
    value,
    limit: BYTE_BUDGET_LIMITS[name],
    unit: name === "requests_before_interaction" ? "count" : "bytes",
    status: typeof value === "number" ? "measured" : "not_found",
    ...extra,
  });

  return {
    metrics: {
      home_document: metric("home_document", size("index.html"), {
        raw_bytes: read("index.html").length,
      }),
      css_total: metric("css_total", sumOrNull(css), { files: css.length }),
      js_before_interactive: metric("js_before_interactive", graphBytes, {
        files: graph.length,
        entries,
        by_file: graphSizes,
        note: "every module the document's scripts statically reach, which the browser must fetch and evaluate before the entry module's code runs. The plan's 35 KB line; nothing lazy-loads in this build yet, so it is the whole graph.",
      }),
      js_to_first_result: metric("js_to_first_result", graphBytes, {
        files: graph.length,
        note: "the same graph today, because no code path defers work between step 1 and the first result. Measured as its own line so the two diverge the moment something does.",
      }),
      locale_strings: metric("locale_strings", localeValue, {
        locales: localeCount,
        file_bytes: localeFileBytes,
        note: "per-locale share of the strings file, which is the plan's line; file_bytes is what the browser actually downloads",
      }),
      registry_country: metric("registry_country", worstEntry[1], {
        worst_country: worstEntry[0],
        by_country: byCountry,
      }),
      requests_before_interaction: metric(
        "requests_before_interaction",
        initialRequests(html, read, has),
        {
          note: "staged same-origin resources the home document references, plus the document. Static reading; the browser-observed count belongs to the quality-lab job.",
        },
      ),
      web_fonts: metric("web_fonts", sumOver(fonts), {
        files: fonts.length,
        note: "the plan's budget is 0 bytes for scripts that system fonts cover; an empty font set is the measurement, not a missing one",
      }),
      heatmap_initial: metric("heatmap_initial", heatmapBytes, {
        page: heatmapPage,
        parts: heatmapParts,
      }),
    },
  };
}

/**
 * Ratchet a reading against the last declared baseline.
 *
 * Regression-blocking only, per §3.2. A metric the baseline does not carry is
 * `unmeasured`, not a pass and not a regression: there is nothing honest to
 * compare against yet.
 */
export function compareToBaseline(metrics, baseline = {}) {
  const regressions = [];
  const improvements = [];
  const unmeasured = [];
  for (const [name, m] of Object.entries(metrics)) {
    const base = baseline[name];
    // A reading that could not be taken is `unmeasured` even when the baseline
    // carries a number: the arithmetic would be NaN, and NaN compares false to
    // everything, which is how a gate ends up silently passing.
    if (typeof m.value !== "number" || !Number.isFinite(m.value)) {
      unmeasured.push({
        metric: name,
        value: m.value ?? null,
        limit: m.limit,
        reason: "not measured on this build",
      });
      continue;
    }
    if (!base || typeof base.value !== "number") {
      unmeasured.push({
        metric: name,
        value: m.value,
        limit: m.limit,
        reason: "no baseline reading",
      });
      continue;
    }
    const delta = m.value - base.value;
    if (delta > REGRESSION_TOLERANCE_BYTES) {
      regressions.push({
        metric: name,
        from: base.value,
        to: m.value,
        delta,
        limit: m.limit,
        message: `${name}: ${kb(base.value)} -> ${kb(m.value)} (+${kb(delta)}) against the declared baseline, limit ${kb(m.limit)}`,
      });
    } else if (delta < -REGRESSION_TOLERANCE_BYTES) {
      improvements.push({
        metric: name,
        from: base.value,
        to: m.value,
        delta,
        message: `${name}: ${kb(base.value)} -> ${kb(m.value)} (${kb(delta)})`,
      });
    }
  }
  return { regressions, improvements, unmeasured };
}
