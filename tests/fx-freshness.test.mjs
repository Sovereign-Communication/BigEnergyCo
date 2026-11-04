// P1.4 (defect F-10): a converted figure says where its rate came from and
// when, on every path - live, stale, and no-live-fetch.
//
// The defect this pins is small and was invisible: `fxNote()` computed an
// `asOf` local and then returned a string that never mentioned it, and the
// form field `#fxAsOf` was written only after a successful fetch, so the
// offline path showed nothing while the static table priced the page.
// Run: node --test tests/fx-freshness.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LOCALES } from "../assets/js/shared/locales.js";
import {
  FX_SOURCE,
  FX_STALE_DAYS,
  fxAgeDays,
  fxFreshness,
} from "../assets/js/shared/fx-freshness.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NOW = Date.parse("2026-11-04T00:00:00Z");
const daysAgo = (n) => new Date(NOW - n * 86400000).toUTCString();

test("P1.4: no as-of date reads as indicative, never as a live rate", () => {
  for (const asOf of [null, undefined, ""]) {
    const f = fxFreshness(asOf, NOW);
    assert.equal(f.state, "indicative", `${String(asOf)} must not claim live`);
    assert.equal(f.key, "fxIndicativeNote");
    assert.equal(f.days, null);
  }
});

test("P1.4: a fresh fetched rate is live and keeps its own date", () => {
  const f = fxFreshness(daysAgo(0), NOW);
  assert.equal(f.state, "live");
  assert.equal(f.key, "fxAsOfNote");
  assert.equal(f.days, 0);
});

test("P1.4: the stale boundary is FX_STALE_DAYS, inclusive", () => {
  const edge = fxFreshness(daysAgo(FX_STALE_DAYS), NOW);
  assert.equal(edge.state, "live", "exactly the threshold is not stale");
  const over = fxFreshness(daysAgo(FX_STALE_DAYS + 1), NOW);
  assert.equal(over.state, "stale");
  assert.equal(over.days, FX_STALE_DAYS + 1);
  assert.equal(over.key, "fxStaleNote");
  assert.equal(fxAgeDays(daysAgo(30), NOW), 30);
});

test("P1.4: an unparseable date still shows the date instead of inventing an age", () => {
  const f = fxFreshness("some future provider format", NOW);
  assert.equal(f.state, "live");
  assert.equal(f.days, null);
  assert.equal(fxAgeDays("some future provider format", NOW), null);
});

test("P1.4: every locale carries the source and the placeholders it needs", () => {
  const langs = Object.keys(LOCALES);
  assert.deepEqual(
    langs.slice().sort(),
    ["ar", "de", "en", "es", "fr", "nl", "pt"],
    "all seven locales ship together",
  );
  for (const lang of langs) {
    const d = LOCALES[lang];
    for (const key of ["fxAsOfNote", "fxStaleNote", "fxIndicativeNote"]) {
      assert.equal(typeof d[key], "string", `${lang} is missing ${key}`);
      assert.ok(
        d[key].includes(FX_SOURCE),
        `${lang}.${key} does not name the source`,
      );
    }
    assert.ok(d.fxAsOfNote.includes("{asOf}"), `${lang} drops the as-of date`);
    assert.ok(d.fxStaleNote.includes("{asOf}"), `${lang} stale line drops date`);
    assert.ok(d.fxStaleNote.includes("{days}"), `${lang} stale line drops age`);
  }
});

test("P1.4: both render paths ask the rule, and the notice renders before the fetch", () => {
  const ui = readFileSync(
    path.join(ROOT, "assets/js/sizing/ui.js"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  assert.match(
    ui,
    /fxFreshness\(fxMeta\.asOf\)/,
    "the assumptions paragraph asks the shared rule",
  );
  assert.match(ui, /FX_SOURCE/, "the paragraph names the source from the module");
  assert.match(
    ui,
    /function renderFxNotice\(\)/,
    "the form-level notice has one renderer",
  );
  assert.match(
    ui,
    /renderFxNotice\(\);\n\n  try \{/,
    "the notice renders before the fetch, so the failure path cannot leave it empty",
  );
  assert.doesNotMatch(
    ui,
    /const asOf = fxMeta\.asOf\s*\n\s*\?\s*` Live rates as of/,
    "the computed-but-unused as-of sentence must not come back",
  );
});
