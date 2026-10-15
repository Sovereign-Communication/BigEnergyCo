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
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { metadataIssues } from "../scripts/lib/seo.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TITLE_MAX = 60; // scripts/lib/seo.mjs — the cap a page title ships under

function runCheck(cwd) {
  return spawnSync(process.execPath, ["scripts/build-city-pages.mjs", "--check"], {
    cwd,
    encoding: "utf8",
  });
}

// A stand-alone copy of everything the generator needs: its two inputs, and the
// pages it is supposed to have produced. The tests that need to WATCH the check
// fail do it here, so the real tree is never mutated.
function scratchRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), "bec-city-pages-"));
  cpSync(join(ROOT, "scripts", "build-city-pages.mjs"), join(dir, "scripts", "build-city-pages.mjs"));
  for (const file of ["cities.js", "pricing.js"]) {
    cpSync(join(ROOT, "assets", "js", "sizing", file), join(dir, "assets", "js", "sizing", file));
  }
  cpSync(join(ROOT, "solar-calculator"), join(dir, "solar-calculator"), { recursive: true });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("GATE: the committed city pages are what their generator produces", () => {
  const r = runCheck(ROOT);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /66 city pages \+ hub match their generator output/);
});

test("GATE: a page edited away from the generator output is caught and named", (t) => {
  const dir = scratchRepo(t);
  const hub = join(dir, "solar-calculator", "index.html");
  writeFileSync(
    hub,
    readFileSync(hub, "utf8").replace("Free Sizing for 66 Cities", "Free Sizing"),
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
  const html = readFileSync(join(ROOT, "solar-calculator", "index.html"), "utf8");
  const [title] = html.match(/<title>([\s\S]*?)<\/title>/).slice(1);
  assert.ok(title.length <= TITLE_MAX, `hub title is ${title.length} over ${TITLE_MAX}`);
  assert.deepEqual(metadataIssues([{ page: "solar-calculator/index.html", html }]), []);
});
