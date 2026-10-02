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
// The label then failed a SECOND time, and that failure is why this file also
// pins meaning rather than just badness. The first repair replaced a non-word
// with "الطبيعي" — grammatical, plausible-looking Arabic that says "not the
// NATURAL AI", where all five siblings say "not the LIVE AI". It passed the
// banned-value rule, because it was not the string the rule named. So the
// original value is banned too, and this file asserts the LIVE wording directly.
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
import { claimsTranslation, unkeyedProse } from "../scripts/lib/gates.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCALES_PATH = join(ROOT, "assets", "js", "shared", "locales.js");
const CHECK = join(ROOT, "scripts", "check-i18n.mjs");

test("BANNED: the known-bad Arabic values are gone", () => {
  // Asserted directly, so this test fails even if the gate is deleted.
  assert.doesNotMatch(
    LOCALES.ar.advisorDegradedLabel,
    /الطناعيا/,
    "advisorDegradedLabel still contains a non-word",
  );
  // Not just "some Arabic" — the MEANING has to match the five siblings, all of
  // which say "not the live AI". "not the natural AI" is valid Arabic that
  // tells the visitor something else entirely.
  assert.match(
    LOCALES.ar.advisorDegradedLabel,
    /الحيّ/,
    "advisorDegradedLabel must say 'not the LIVE AI', as en/es/pt/fr/de do",
  );
  assert.doesNotMatch(
    LOCALES.ar.advisorDegradedLabel,
    /الطبيعي/,
    "advisorDegradedLabel must not say 'the natural one'",
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
  // An untranslated English fragment inside an Arabic sentence: every sibling
  // translates "plausible", so a Latin word here is a leak, not a loanword.
  assert.doesNotMatch(
    LOCALES.ar.sanityOk,
    /plausible/,
    "ar.sanityOk still carries the English word 'plausible'",
  );
  // "التقليدي" is "traditional". The siblings say typical-YEAR, which is what
  // the offline badge actually asserts about the numbers.
  assert.doesNotMatch(
    LOCALES.ar.offlineNote,
    /التقليدي/,
    "ar.offlineNote says 'traditional', not 'typical-year'",
  );
  assert.match(
    LOCALES.ar.offlineNote,
    /النموذجية/,
    "ar.offlineNote should say 'typical year', not 'traditional'",
  );
});

test("BANNED: reintroducing any known-bad value makes the gate fail", () => {
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
      "دون اتصال · ليس الذكاء الطبيعي مباشرة",
      "تم التحقق بشكل مستقل ✓ — plausible من الناحية الفيزيائية",
      " · 🌐 وضع عدم الاتصال التقليدي",
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
      "دون اتصال · ليس الذكاء الحيّ مباشرة",
      "دون اتصال · ليس الذكاء الطناعيا مباشرة",
    ],
    [
      "لا مفتاح نموذج، فالمشير غير متصل عمدًا",
      "لا مفتاح مدية، فالمشير منطقً عند الاتصال",
    ],
    [
      "دون اتصال · ليس الذكاء الحيّ مباشرة",
      "دون اتصال · ليس الذكاء الطبيعي مباشرة",
    ],
    [
      "تم التحقق بشكل مستقل ✓ — معقول فيزيائيًا",
      "تم التحقق بشكل مستقل ✓ — plausible من الناحية الفيزيائية",
    ],
    [" · 🌐 وضع السنة النموذجية دون اتصال", " · 🌐 وضع عدم الاتصال التقليدي"],
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

test("PROSE: the two remaining paragraphs are keyed, hooks on inner elements", () => {
  // These two shipped as English to every non-English visitor: 61 words in the
  // hero and 31 in the legal card, neither carrying a hook, so no rule in
  // check-i18n could see them. Both now have a key in all six locales.
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.match(
    html,
    /data-i18n="heroIntro"/,
    "the hero paragraph must be keyed",
  );
  assert.match(
    html,
    /data-i18n="advisorIsAi"/,
    "the advisor disclaimer must be keyed",
  );
  for (const key of ["heroIntro", "advisorIsAi"]) {
    for (const lang of ["en", "es", "pt", "fr", "de", "ar"]) {
      assert.equal(
        typeof LOCALES[lang][key],
        "string",
        `${lang} is missing ${key}`,
      );
      // en IS the English, so the equality check only means something for the
      // five locales that are supposed to differ from it.
      if (lang !== "en")
        assert.notEqual(
          LOCALES[lang][key],
          LOCALES.en[key],
          `${lang}.${key} is identical to English — it was never translated`,
        );
    }
  }
  // The hook brackets the <strong>, because applyI18n writes textContent: a
  // hook on the <p> itself would delete the element holding the author's name.
  assert.match(
    html,
    /data-i18n="heroIntro"[\s\S]{0,900}?<\/span\s*>\s*<strong>Lucas Ballek<\/strong>/,
    "heroIntro must end before the <strong>, not wrap it",
  );
});

test("PROSE: the unkeyed-prose detector fires on unhooked prose, and only on prose", () => {
  // A gate nobody has seen red is not a gate. This proves the DETECTOR — the
  // function rule 9 is built on — recognises the exact markup shape that caused
  // the defect, without mutating the working tree.
  const PROSE =
    "Start with your location and we size every option that could cut your bill.";
  assert.equal(
    unkeyedProse(`<p>${PROSE}</p>`).length,
    1,
    "an unhooked prose paragraph must be reported",
  );
  assert.equal(
    unkeyedProse(`<p data-i18n="heroIntro">${PROSE}</p>`).length,
    0,
    "a hook on the element exempts it",
  );
  // The real shape of the hero fix: the hook is on an inner span so the
  // <strong> survives applyI18n's textContent. That must NOT read as unkeyed.
  assert.equal(
    unkeyedProse(
      `<p><span data-i18n="heroIntro">${PROSE}</span> <strong>Lucas</strong>.</p>`,
    ).length,
    0,
    "a hook on a descendant exempts the paragraph",
  );
  // The exemptions: not prose, and too short to be prose.
  assert.equal(
    unkeyedProse("<p>5 m² · 12 kWh · 3.5 %</p>").length,
    0,
    "units are not prose",
  );
  assert.equal(
    unkeyedProse("<p>Send</p>").length,
    0,
    "a one-word label is not prose",
  );
  assert.equal(
    unkeyedProse("<p></p>").length,
    0,
    "an empty block is not prose",
  );
});

test("PROSE: nesting does not hide a paragraph from the detector", () => {
  // The detector used to require a literal `</tag>`, so a paragraph nested
  // inside a <label> or a <li> was swallowed whole by its parent's match and
  // never examined — 12 real English blocks on index.html hid that way, and a
  // ceiling of 39 was satisfiable while they shipped. Measured in a browser at
  // Accept-Language de-DE: 48 of the 51 blocks the fixed detector reports are
  // English in the rendered DOM.
  const PROSE =
    "Satellite imagery loads only after you ask for it, and coordinates are rounded.";
  assert.equal(
    unkeyedProse(`<label>Roof area <p>${PROSE}</p></label>`).length,
    1,
    "a paragraph inside a label must still be reported",
  );
  // </li> is OPTIONAL in valid HTML5: the parser ends the item at the next <li>
  // or at </ul>. Requiring the close tag missed two unhooked items in a row.
  assert.equal(
    unkeyedProse(`<ul><li>${PROSE}<li>${PROSE}</ul>`).length,
    2,
    "unclosed list items are valid HTML and must both be reported",
  );
  assert.equal(
    unkeyedProse(
      `<ul><li data-i18n="row"><span data-i18n="row"></span>${PROSE}<li>${PROSE}</ul>`,
    ).length,
    1,
    "a hooked first item must not exempt the unhooked second one",
  );
  assert.equal(
    unkeyedProse(`<p>${PROSE}`).length,
    1,
    "an unclosed paragraph is still reported",
  );
});

test("PROSE: text no visitor can read is not reported as prose", () => {
  // A comment or a <script> is not copy. index.html carries a 4.9 KB JSON-LD
  // block; if the scanner reads inside it, the ceiling becomes hostage to any
  // future comment containing a long <p> example.
  const PROSE =
    "Every number comes from testable code simulating your exact location.";
  assert.equal(
    unkeyedProse(`<!-- <p>${PROSE}</p> -->`).length,
    0,
    "a comment is not visible prose",
  );
  assert.equal(
    unkeyedProse(`<script>var a="<p>${PROSE}</p>";</script>`).length,
    0,
    "a script body is not visible prose",
  );
  assert.equal(
    unkeyedProse(`<style>/* <p>${PROSE}</p> */</style>`).length,
    0,
    "a style body is not visible prose",
  );
  // Panels hidden at first paint ARE reported: they are what the visitor reads
  // the moment they click. Suppressing them would hide the exact strings that
  // leak on interaction.
  assert.equal(
    unkeyedProse(`<p style="display:none">${PROSE}</p>`).length,
    1,
    "a hidden panel is reported: it is what appears on click",
  );
});

test("PROSE: hook detection agrees with the browser about attribute case", () => {
  // HTML attribute NAMES are case-insensitive and querySelector resolves
  // DATA-I18N exactly as it resolves data-i18n. A case-sensitive check reports a
  // hooked block as unkeyed while the page translates it correctly — the gate
  // and the renderer disagreeing about identical markup.
  const PROSE =
    "Your monthly electric bill is auto-adjusted to your location's prices.";
  assert.equal(
    unkeyedProse(`<p DATA-I18N="loadBill">${PROSE}</p>`).length,
    0,
    "an uppercase hook is still a hook",
  );
  assert.equal(
    claimsTranslation('<span DATA-I18N="x"></span>'),
    true,
    "a page using only uppercase hooks still claims translation",
  );
});

test("PROSE: only pages that claim translation are checked", () => {
  // 81 of 82 shipped pages carry no hook at all and are untranslated by
  // decision. A gate that fired on all of them would be a gate nobody runs.
  assert.equal(claimsTranslation('<span data-i18n="x"></span>'), true);
  assert.equal(claimsTranslation('<input data-i18n-placeholder="x">'), true);
  assert.equal(
    claimsTranslation("<p>Plain English prose, with no hook at all.</p>"),
    false,
  );
});

test("PROSE: the ceiling is a committed constant, not an env override", () => {
  // An env-overridable ceiling is a gate anyone can loosen without a diff.
  const src = readFileSync(join(ROOT, "scripts", "check-i18n.mjs"), "utf8");
  assert.doesNotMatch(
    src,
    /process\.env\.[A-Z_]*PROSE[A-Z_]*/,
    "the unkeyed-prose ceiling must not be environment-overridable",
  );
  assert.match(
    src,
    /const PROSE_CEILING = \d+;/,
    "the ceiling must be a committed constant",
  );
});
