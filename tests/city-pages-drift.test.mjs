// The generator is the single source of truth for solar-calculator/**, and this
// file proves `build-city-pages.mjs --check` is the gate that says so.
//
// The defect it exists for: the generator's hub title had drifted to 62
// characters while the committed page carried the 52-character one. check-seo
// reads the committed page (correct) and --check validated the generator's own
// strings (self-consistent), so nothing reddened — regenerating the pages was
// the only way to fail the SEO gate, and only by hand. Drift like that is
// invisible precisely because both sides pass their own tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { metadataIssues } from "../scripts/lib/seo.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TITLE_MAX = 60; // scripts/lib/seo.mjs — the cap a page title ships under

function runCheck(cwd) {
  return spawnSync(
    process.execPath,
    ["scripts/build-city-pages.mjs", "--check"],
    {
      cwd,
      encoding: "utf8",
    },
  );
}

// A stand-alone copy of everything the generator needs: its two inputs, and the
// pages it is supposed to have produced. The tests that need to WATCH the check
// fail do it here, so the real tree is never mutated.
function scratchRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), "bec-city-pages-"));
  cpSync(
    join(ROOT, "scripts", "build-city-pages.mjs"),
    join(dir, "scripts", "build-city-pages.mjs"),
  );
  for (const file of ["cities.js", "pricing.js"]) {
    cpSync(
      join(ROOT, "assets", "js", "sizing", file),
      join(dir, "assets", "js", "sizing", file),
    );
  }
  cpSync(join(ROOT, "solar-calculator"), join(dir, "solar-calculator"), {
    recursive: true,
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("GATE: the committed city pages are what their generator produces", () => {
  const r = runCheck(ROOT);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /66 city pages \+ hub match their generator output/);
});

test("GATE: city callouts and footers keep presentation in named classes", () => {
  const city = readFileSync(
    join(ROOT, "solar-calculator", "honolulu", "index.html"),
    "utf8",
  );
  const hub = readFileSync(
    join(ROOT, "solar-calculator", "index.html"),
    "utf8",
  );
  assert.doesNotMatch(`${city}\n${hub}`, /\sstyle=/i);
  assert.match(city, /class="cta-box city-sizing-cta"/);
  assert.match(city, /class="city-sizing-cta__title"/);
  assert.match(city, /class="city-sizing-cta__copy"/);
  assert.match(city, /class="city-footer-links"/);
  assert.match(
    city,
    /\.city-sizing-cta\s*\{[^}]*margin:\s*1\.5rem 0 2rem;[^}]*background:\s*rgba\(0, 230, 153, \.08\);/s,
  );
  assert.match(
    city,
    /\.city-sizing-cta__title\s*\{[^}]*font-weight:\s*700;[^}]*color:\s*#fff;[^}]*margin-bottom:\s*\.4rem;/s,
  );
  assert.match(
    city,
    /\.city-sizing-cta__copy\s*\{[^}]*color:\s*var\(--muted\);[^}]*font-size:\s*\.92rem;[^}]*margin-bottom:\s*\.75rem;/s,
  );
  assert.match(city, /\.city-footer-links\s*\{\s*margin-top:\s*\.75rem;\s*\}/);
  assert.match(hub, /class="worldwide-notice"/);
  assert.match(hub, /class="worldwide-notice__title"/);
  assert.match(hub, /class="worldwide-notice__copy"/);
  assert.match(
    hub,
    /\.worldwide-notice\s*\{[^}]*margin:\s*1\.25rem 0 2rem;[^}]*display:\s*flex;[^}]*gap:\s*1rem;/s,
  );
  assert.match(
    hub,
    /\.worldwide-notice__title\s*\{[^}]*font-weight:\s*800;[^}]*font-size:\s*1\.1rem;[^}]*color:\s*#fff;[^}]*margin-bottom:\s*\.3rem;/s,
  );
  assert.match(
    hub,
    /\.worldwide-notice__copy\s*\{[^}]*margin:\s*0;[^}]*line-height:\s*1\.5;[^}]*max-width:\s*620px;/s,
  );
});

test("GATE: a page edited away from the generator output is caught and named", (t) => {
  const dir = scratchRepo(t);
  const hub = join(dir, "solar-calculator", "index.html");
  writeFileSync(
    hub,
    readFileSync(hub, "utf8").replace(
      "Free Sizing for 66 Cities",
      "Free Sizing",
    ),
  );
  const r = runCheck(dir);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(
    r.stderr,
    /FAIL solar-calculator\/index\.html: differs from the generator output/,
  );
  assert.match(r.stderr, /FAIL 1 generated page\(s\) out of date/);
});

test("GATE: a missing city page is caught and named", (t) => {
  const dir = scratchRepo(t);
  rmSync(join(dir, "solar-calculator", "tokyo", "index.html"));
  const r = runCheck(dir);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /FAIL solar-calculator\/tokyo\/index\.html: missing/);
});

test("GATE: the hub title stays inside the SEO cap the shipped page passes", () => {
  // The generator and the committed page agree after the drift fix; this pins
  // the rule the generator once broke, so a future 62-character title fails
  // here rather than in check-seo, where it only appears after regenerating.
  const html = readFileSync(
    join(ROOT, "solar-calculator", "index.html"),
    "utf8",
  );
  const [title] = html.match(/<title>([\s\S]*?)<\/title>/).slice(1);
  assert.ok(
    title.length <= TITLE_MAX,
    `hub title is ${title.length} over ${TITLE_MAX}`,
  );
  assert.deepEqual(
    metadataIssues([{ page: "solar-calculator/index.html", html }]),
    [],
  );
});
// ── what the worked example must not claim ────────────────────────────────
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
      /<h2>Worked example[^<]*<\/h2>\s*<p>([\s\S]*?)<\/p>/,
    );
    const payback = html.match(/<\/table>\s*<\/div>\s*<p>([\s\S]*?)<\/p>/);
    if (!intro || !payback) {
      misshapen.push(slug);
      continue;
    }
    // The unit has to sit on the paragraph that quotes the money, and that
    // paragraph has to quote money, so the clause cannot be hoisted into a
    // sentence with no figures in it.
    if (!/US dollars/.test(payback[1]) || !/\$\d/.test(payback[1]))
      moneyUnlabelled.push(slug);
    // ... and the battery column has to be named as the one the simulator
    // re-sizes, rather than left reading as the bank to build.
    if (!/darkest week/.test(intro[1])) batteryUnlabelled.push(slug);
  }
  assert.deepEqual(
    misshapen,
    [],
    `city pages whose worked example is not shaped as the generator writes it: ${misshapen.join(", ")}`,
  );
  assert.deepEqual(
    moneyUnlabelled,
    [],
    `city pages quoting money without naming its currency: ${moneyUnlabelled.join(", ")}`,
  );
  assert.deepEqual(
    batteryUnlabelled,
    [],
    `city pages presenting the band-only battery figure as the size to build: ${batteryUnlabelled.join(", ")}`,
  );
});
