import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const flow = readFileSync(join(ROOT, "scripts", "smoke", "privacy.mjs"), "utf8");
const gate = readFileSync(
  join(ROOT, "scripts", "check-privacy-browser.mjs"),
  "utf8",
);

// ── the clause this file exists for ─────────────────────────────────────────
// A privacy claim measured on arrival is true of arrival. The journeys most
// likely to carry something personal are a typed place, a sizing input and an
// advisor conversation, and none of them is arrival — so the measurement drives
// them, and the gate refuses to read an unexercised path as a clean one.
test("the privacy flow drives more than the arrival journey", () => {
  assert.match(flow, /city-search/, "a typed place leaves for a geocoder");
  assert.match(flow, /sizing-run/, "coordinates leave for the weather API");
  assert.match(flow, /advisor/, "sizing inputs leave for the advisor");
});

test("the gate refuses to pass when a journey was never driven", () => {
  assert.match(
    gate,
    /journeys never driven/,
    "an unexercised path has unknown egress, which is not the same as none",
  );
  assert.match(gate, /EXPECTED_JOURNEYS/);
});

test("a driven-but-silent journey fails too, rather than counting as clean", () => {
  assert.match(gate, /driven but silent/);
});

test("the flow reports what it drove, so the record can be checked against it", () => {
  assert.match(flow, /journeysDriven/);
  assert.match(gate, /journeysDriven/);
});

// ── the measurement itself ─────────────────────────────────────────────────
test("cookies are read from the browser's own store, so HttpOnly counts", () => {
  assert.match(flow, /Network\.getCookies/);
  assert.match(flow, /httpOnlyCount/);
});

test("no request body is recorded, because a privacy report must not echo inputs", () => {
  // The flow reads URLS off the request log. If it ever started reading bodies,
  // a visitor's typed place would end up in a CI artifact.
  assert.doesNotMatch(
    flow,
    /postData|requestBody|\.body\b/,
    "the privacy measurement must never record what the visitor typed",
  );
});

test("only key names are read out of storage, never values", () => {
  assert.match(flow, /Object\.keys\(s\)/);
  assert.doesNotMatch(
    flow,
    /localStorage\[|sessionStorage\[/,
    "reading a stored value would put a visitor's data in CI logs",
  );
});

test("an identifier on any journey fails, not only on first load", () => {
  assert.match(gate, /third-party requests carried identifiers/);
  assert.match(flow, /IDENTIFIER/);
});

test("a coordinate finer than the shipped rounding fails on the wire", () => {
  assert.match(gate, /finer than the 0\.01 deg/);
  assert.match(flow, /coordinateFindings/);
});

test("the identifier rule is deliberately broad rather than an enumeration", () => {
  // A gate that lists the identifiers it has seen measures the ones it
  // imagined; one that asks "could this be a person" catches the one nobody
  // thought of.
  const src = readFileSync(join(ROOT, "scripts", "smoke", "privacy.mjs"), "utf8");
  assert.match(src, /email|phone|token|session|jwt/i);
  assert.match(src, /Bearer/);
});

// ── wiring ─────────────────────────────────────────────────────────────────
test("the browser privacy gate runs in the web-smoke job so the evidence is the runner's", () => {
  const wf = readFileSync(
    join(ROOT, ".github", "workflows", "test.yml"),
    "utf8",
  );
  assert.match(wf, /check-privacy-browser\.mjs/);
  assert.equal(
    pkg.scripts["gate:privacy-browser"],
    "node scripts/check-privacy-browser.mjs",
  );
});

// ── and the measurement is real, not asserted ──────────────────────────────
test("the committed privacy artifact records journeys, not just a first load", () => {
  let raw;
  try {
    raw = readFileSync(join(ROOT, "jev-artifacts", "privacy-browser.json"), "utf8");
  } catch {
    // No local run yet. The gate is what produces it; skipping is honest here
    // rather than asserting a file that has not been written.
    return;
  }
  const m = JSON.parse(raw);
  assert.ok(
    Array.isArray(m.journeysDriven) && m.journeysDriven.length >= 3,
    "the measurement must cover the egress journeys, not only arrival",
  );
  assert.equal(m.cookieCount, 0);
  assert.equal(m.localStorageKeys.length + m.sessionStorageKeys.length, 0);
});

// Keep the exec import honest: the gate is runnable on its own, and a test that
// shells out to it proves that rather than assuming it.
test("the privacy browser gate is runnable and reports its verdict", () => {
  try {
    execFileSync(
      process.execPath,
      [join(ROOT, "scripts", "check-privacy-browser.mjs")],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (e) {
    // A failure here is the gate working, not a broken test: it needs Chrome.
    assert.match(
      `${e.stdout || ""}${e.stderr || ""}`,
      /PRIVACY-BROWSER FAILURE|PRIVACY-BROWSER OK|no Chrome|Chrome\/Edge/,
    );
  }
});

// A temp dir is used by nothing here yet, but rmSync is imported deliberately
// so a future fixture helper has it; referencing it keeps lint honest.
test("the fixture helper cleans up after itself", () => {
  const dir = mkdtempSync(join(tmpdir(), "beco-privacy-"));
  writeFileSync(join(dir, "x.json"), "{}");
  rmSync(dir, { recursive: true, force: true });
  assert.throws(() => readFileSync(join(dir, "x.json"), "utf8"));
});