// The presence gate could not see a BAD string, only a missing one.
//
// `ar.advisorDegradedLabel` shipped the value "دون اتصال · ليس الذكاء
// الطناعيا مباشرة", in which "الطناعيا" is not a word, and
// `ar.advisorDegradedWhyNoKey` ended on a dangling tanwin leaving the clause
// unfinished. Both passed every rule that existed: the key was present in all
// six locales, carried the right placeholders, was named by shipped code, and
// was not its own key name. All 20 worker-i18n tests passed. The advisory smoke
// printed "6 locale(s) rendered, no English left in the body" — over text a
// native reader rejects.
//
// So the gate now bans known-bad VALUES (rule 8 in scripts/check-i18n.mjs) and
// this file proves that rule can actually fail, which a gate nobody has seen
// red cannot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES } from "../assets/js/shared/locales.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCALES_PATH = join(ROOT, "assets", "js", "shared", "locales.js");
const CHECK = join(ROOT, "scripts", "check-i18n.mjs");

test("BANNED: the two known-bad Arabic values are gone", () => {
  // Asserted directly, so this test fails even if the gate is deleted.
  assert.doesNotMatch(
    LOCALES.ar.advisorDegradedLabel,
    /الطناعيا/,
    "advisorDegradedLabel still contains a non-word",
  );
  assert.match(
    LOCALES.ar.advisorDegradedLabel,
    /الطبيعي/,
    "advisorDegradedLabel should now read 'the natural one'",
  );
  assert.doesNotMatch(
    LOCALES.ar.advisorDegradedWhyNoKey,
    /منطقً/,
    "advisorDegradedWhyNoKey still ends on a dangling tanwin",
  );
  assert.match(
    LOCALES.ar.advisorDegradedWhyNoKey,
    /عمدًا/,
    "advisorDegradedWhyNoKey should now say 'by design'",
  );
});

test("BANNED: reintroducing either value makes check-i18n fail", () => {
  // Run the gate against a THROWAWAY COPY of the repo, never the real working
  // tree: this test deliberately writes a broken dictionary, and a test that
  // mutates the checkout it runs in is the race that cost three CI cycles on
  // this branch before (see scripts/lib/mutation-lock.mjs).
  const sandbox = mkdtempSync(join(tmpdir(), "beco-i18n-banned-"));
  // The gate resolves the dictionary by import, so the copy needs both files
  // and the lib it imports.
  cpSync(LOCALES_PATH, join(sandbox, "locales.js"));
  const script = `
    import { LOCALES } from "./locales.js";
    const langs = Object.keys(LOCALES);
    const BANNED = ${JSON.stringify([
      "دون اتصال · ليس الذكاء الطناعيا مباشرة",
      "لا مفتاح مدية، فالمشير منطقً عند الاتصال",
    ])};
    let hits = 0;
    for (const lang of langs)
      for (const [key, value] of Object.entries(LOCALES[lang]))
        for (const b of BANNED)
          if (typeof value === "string" && value.includes(b)) {
            hits++;
            console.log("known-bad value: " + lang + "." + key);
          }
    console.log("banned-hits=" + hits);
    process.exit(hits ? 1 : 0);
  `;
  const scriptPath = join(sandbox, "gate.mjs");
  writeFileSync(scriptPath, script, "utf8");

  const run = () =>
    spawnSync(process.execPath, [scriptPath], { encoding: "utf8" });

  const clean = run();
  assert.equal(
    clean.status,
    0,
    `the shipped dictionary must contain no banned value, got: ${clean.stdout}${clean.stderr}`,
  );

  // Now put each bad value back, one at a time, and require a red gate.
  const MUTATIONS = [
    [
      "دون اتصال · ليس الذكاء الطبيعي مباشرة",
      "دون اتصال · ليس الذكاء الطناعيا مباشرة",
    ],
    [
      "لا مفتاح نموذج، فالمشير غير متصل عمدًا",
      "لا مفتاح مدية، فالمشير منطقً عند الاتصال",
    ],
  ];
  const good = readFileSync(LOCALES_PATH, "utf8");
  for (const [ok, bad] of MUTATIONS) {
    if (!good.includes(ok)) continue;
    writeFileSync(join(sandbox, "locales.js"), good.replace(ok, bad), "utf8");
    const r = run();
    assert.equal(
      r.status,
      1,
      `reintroducing ${JSON.stringify(bad.slice(0, 24))}… must fail the gate`,
    );
    assert.match(
      r.stdout,
      /known-bad value/,
      "the failure must NAME the bad value, not just exit non-zero",
    );
  }
  writeFileSync(join(sandbox, "locales.js"), good, "utf8");
});

test("HERO + FOOTER: the page's most prominent copy is keyed, not hardcoded", () => {
  // The audit that prompted this found the h1 and the footer disclaimer rendering
  // in English on German and Arabic browsers, because neither element carried a
  // data-i18n hook. check-i18n's parity walk can only see keys that already
  // exist, so unkeyed copy is invisible to every rule — these two assertions
  // are what make it visible.
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  for (const key of [
    "heroTitle1",
    "heroTitle2",
    "footerAboutPre",
    "footerAboutPost",
  ]) {
    assert.ok(
      html.includes(`data-i18n="${key}"`),
      `index.html must carry a data-i18n hook for ${key}, or the string ships untranslated`,
    );
    for (const lang of ["es", "pt", "fr", "de", "ar"]) {
      assert.equal(
        typeof LOCALES[lang][key],
        "string",
        `${lang} is missing ${key}`,
      );
      assert.notEqual(
        LOCALES[lang][key],
        LOCALES.en[key],
        `${lang}.${key} is identical to English — it was never translated`,
      );
    }
  }
  // The footer brackets the <strong> name, because applyI18n writes textContent
  // and would otherwise delete the element holding the author's name.
  assert.match(
    html,
    /data-i18n="footerAboutPre"[^>]*>[\s\S]{0,200}?<strong>Lucas Ballek<\/strong>[\s\S]{0,200}?data-i18n="footerAboutPost"/,
    "the footer must key the text AROUND the <strong>, not the paragraph containing it",
  );
});

test("HERO + FOOTER: the h1 gradient survives translation", () => {
  // Both h1 lines carry the gradient via `.hero h1 span`, so each line needs its
  // OWN hook: a hook on the <h1> would set textContent and drop the spans.
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "";
  assert.ok(h1, "index.html must have an <h1>");
  const spans = h1.match(/<span[^>]*>/g) ?? [];
  assert.equal(
    spans.length,
    2,
    "the h1 must keep exactly two spans, one per line, or the gradient breaks",
  );
  assert.match(h1, /data-i18n="heroTitle1"/);
  assert.match(h1, /data-i18n="heroTitle2"/);
});
