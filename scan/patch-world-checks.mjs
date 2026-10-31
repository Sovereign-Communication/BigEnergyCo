// Adds the checks the worldwide measurement's fixes are held by: two unit tests
// and three browser-smoke gates. EOL-preserving, every anchor asserted.
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/tmp/world-fix";
const CRLF = (s) => s.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");

function replaceOnce(file, oldText, newText, label) {
  const path = `${ROOT}/${file}`;
  const src = readFileSync(path, "utf8");
  const count = src.split(oldText).length - 1;
  if (count !== 1) {
    console.error(`FAIL ${file}: ${label} matched ${count} times (want 1)`);
    process.exit(1);
  }
  writeFileSync(path, src.replace(oldText, newText));
  console.log(`OK   ${file}: ${label}`);
}

function appendToEnd(file, text, label) {
  const path = `${ROOT}/${file}`;
  const src = readFileSync(path, "utf8");
  if (!src.endsWith("\r\n")) {
    console.error(`FAIL ${file}: expected CRLF at EOF`);
    process.exit(1);
  }
  writeFileSync(path, src + CRLF(text));
  console.log(`OK   ${file}: ${label}`);
}

// ── 1. tests/i18n.test.mjs ────────────────────────────────────────────────
const I18N_TEST = `// ── the use-case card's sentences cannot take the metric fragment ──────────
// Measured on the deployed calculator, 2026-10-14, in every market of the
// worldwide sample (New York, London, Berlin, Tokyo, Lagos, Delhi, Santiago,
// Ho Chi Minh City, Suva, Papeete, Kathmandu): the outcome card a visitor got
// read "Your Cut my electricity bill result", and its footer read "Measured for
// Cut my electricity bill against of your bill removed over 20 years, using
// this location's own hourly weather". Two shapes caused it, and both are
// structural rather than typographic:
//
//   * useCaseVerdictFooter and useCaseNotMeasured interpolated {metric}, whose
//     value is a label-relative fragment ("of your bill removed over 20 years",
//     "what holding a reserve costs, in savings and hours"). A fragment that
//     reads correctly under the number it labels cannot also follow a
//     preposition or a negation, which is the only slot those sentences have;
//   * useCaseOutcomeTitle put the case label — an imperative sentence
//     ("Cut my electricity bill") — into a possessive slot, which no wording of
//     the frame can save.
//
// So the fragment stays where it reads (under the number), and the label stays
// in a slot where it reads as its own sentence (after a colon).
test("use-case card sentences do not interpolate the metric fragment", () => {
  const bad = [];
  for (const [lang, dict] of Object.entries(LOCALES)) {
    for (const key of ["useCaseVerdictFooter", "useCaseNotMeasured"]) {
      if (!dict[key]) bad.push(\`\${lang}.\${key} (missing)\`);
      else if (/\\{metric\\}/.test(dict[key])) bad.push(\`\${lang}.\${key}\`);
    }
    if (!/\\:\\s*\\{useCase\\}/.test(dict.useCaseOutcomeTitle || ""))
      bad.push(\`\${lang}.useCaseOutcomeTitle (the case must follow a colon)\`);
  }
  assert.deepEqual(
    bad,
    [],
    \`sentences that interpolate a label or a fragment into a slot that cannot take one: \${bad.join(", ")}\`,
  );
});
`;
appendToEnd("tests/i18n.test.mjs", I18N_TEST, "use-case sentence test");

// ── 2. tests/city-pages-drift.test.mjs ────────────────────────────────────
const DRIFT_TEST = `// ── what the worked example must not claim ────────────────────────────────
// Measured 2026-10-14 by driving the deployed calculator for eleven markets
// (New York, London, Berlin, Tokyo, Lagos, Delhi, Santiago, Ho Chi Minh City,
// Suva, Papeete, Kathmandu) at a 10 kWh/day load with a 60% bill-cut goal, then
// reading the same inputs off that market's committed page:
//
//   * every page quoted US-dollar benchmarks under a bare "$" while the
//     calculator converts every amount into the visitor's own currency (the
//     sample got £, €, ￥, ₦, ₹, CLP, ₫, FJD, FCFP and NPR back);
//   * the battery column came from a flat band heuristic, and the engine —
//     which sizes the bank against the location's own darkest week — landed
//     above the page's band top in eight of the eleven markets (6–7 kWh against
//     a 3–5 kWh band) and at its floor in the other three.
//
// The generator cannot run the hourly engine, so no band it computes can
// promise the simulator's number. What it can do is stop implying otherwise,
// which is what these two clauses are — and this is what keeps them.
test("GATE: every city page names the unit of its money and labels the battery column", () => {
  const slugs = readdirSync(join(ROOT, "solar-calculator"), {
    withFileTypes: true,
  })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  assert.equal(slugs.length, 66, "expected the full catalog of city pages");

  const moneyUnlabelled = [];
  const batteryUnlabelled = [];
  const misshapen = [];
  for (const slug of slugs) {
    const html = readFileSync(
      join(ROOT, "solar-calculator", slug, "index.html"),
      "utf8",
    );
    const intro = html.match(
      /<h2>Worked example[^<]*<\\/h2>\\s*<p>([\\s\\S]*?)<\\/p>/,
    );
    const payback = html.match(/<\\/table>\\s*<\\/div>\\s*<p>([\\s\\S]*?)<\\/p>/);
    if (!intro || !payback) {
      misshapen.push(slug);
      continue;
    }
    // The unit has to sit on the paragraph that quotes the money, and that
    // paragraph has to quote money, so the clause cannot be hoisted into a
    // sentence with no figures in it.
    if (!/US dollars/.test(payback[1]) || !/\\$\\d/.test(payback[1]))
      moneyUnlabelled.push(slug);
    // ... and the battery column has to be named as the one the simulator
    // re-sizes, rather than left reading as the bank to build.
    if (!/darkest week/.test(intro[1])) batteryUnlabelled.push(slug);
  }
  assert.deepEqual(
    misshapen,
    [],
    \`city pages whose worked example is not shaped as the generator writes it: \${misshapen.join(", ")}\`,
  );
  assert.deepEqual(
    moneyUnlabelled,
    [],
    \`city pages quoting money without naming its currency: \${moneyUnlabelled.join(", ")}\`,
  );
  assert.deepEqual(
    batteryUnlabelled,
    [],
    \`city pages presenting the band-only battery figure as the size to build: \${batteryUnlabelled.join(", ")}\`,
  );
});
`;
replaceOnce(
  "tests/city-pages-drift.test.mjs",
  'import {\r\n  cpSync,\r\n  mkdtempSync,\r\n  readFileSync,\r\n  rmSync,\r\n  writeFileSync,\r\n} from "node:fs";',
  'import {\r\n  cpSync,\r\n  mkdtempSync,\r\n  readFileSync,\r\n  readdirSync,\r\n  rmSync,\r\n  writeFileSync,\r\n} from "node:fs";',
  "readdirSync import",
);
appendToEnd("tests/city-pages-drift.test.mjs", DRIFT_TEST, "worked-example test");

// ── 3. scripts/smoke/gridtie.js ───────────────────────────────────────────
// Placed in the time-of-use phase, the only place a real browser renders the
// cash slots of the use-case verdict.
const SMOKE_ANCHOR =
  '  gate(\r\n    "battery-only frontier verdict describes shifting peak hours",\r\n    /peak hours|shift/i.test(frontierText),\r\n  );\r\n';
const SMOKE_NEW =
  SMOKE_ANCHOR +
  CRLF(`  // The use-case card, read as a visitor reads it. Measured 2026-10-14 across
  // eleven markets: the card's title read "Your Cut my electricity bill
  // result", its footer interpolated the metric fragment ("against of your bill
  // removed over 20 years"), and the time-of-use verdict printed its cash
  // amounts as bare USD integers — "worth about 9720 over 20 years against a
  // 4100 battery" — with no currency in any market. The words are pinned in
  // tests/i18n.test.mjs; the amounts can only be seen here, where the card is
  // actually rendered.
  const outcome = await evaluate(\`(() => {
      const e = document.getElementById("useCaseOutcomeWrap");
      return e ? e.innerText.replace(/\\\\s+/g, " ").trim() : "";
    })()\`);
  gate(
    "use-case card renders without an unresolved placeholder",
    outcome.length > 0 && !outcome.includes("{"),
    outcome.slice(0, 200),
  );
  gate(
    "time-of-use verdict shows its amounts as money",
    /worth about /.test(outcome) && !/worth about \\\\d/.test(outcome),
    outcome.slice(0, 200),
  );
  gate(
    "peak-to-off-peak spread is shown as money per kWh",
    /spread here is /.test(outcome) && !/spread here is \\\\d/.test(outcome),
    outcome.slice(0, 200),
  );
`);
replaceOnce("scripts/smoke/gridtie.js", SMOKE_ANCHOR, SMOKE_NEW, "use-case card gates");

console.log("\nall edits applied");
