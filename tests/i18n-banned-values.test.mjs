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
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES } from "../scripts/lib/locale-data.mjs";
import {
  claimsTranslation,
  unkeyedCopyAttributes,
  unkeyedProse,
  untranslatedLocaleValues,
} from "../scripts/lib/gates.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCALES_DIR = join(ROOT, "assets", "i18n");
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

test("BACK-TRANSLATION: reviewed fixes retain the source meaning", () => {
  assert.match(
    LOCALES.de.touDefaultNote,
    /Ändere einen der beiden Werte/,
    "touDefaultNote must allow changing either one value, not require changing both",
  );
  assert.match(
    LOCALES.fr.pathsDiyRestricted,
    /installation du système par vos soins est restreinte/,
    "pathsDiyRestricted must refer to DIY system installation, not self-consumption",
  );
  assert.match(
    LOCALES.fr.frontierMarkerOffCurve,
    /parc de batteries moins cher qui doit être remplacé/,
    "frontierMarkerOffCurve must say that the cheaper battery bank needs replacement",
  );
  assert.match(
    LOCALES.de.advisorDegradedSystem,
    /zugelassenen Elektriker/,
    "advisorDegradedSystem must retain the licensed electrician qualification",
  );
  assert.match(
    LOCALES.de.frontierIntro,
    /Alle Systeme, die wir an deinem Standort bauen können, vom günstigsten aufwärts.*das beste Ergebnis, das sich mit jedem Budget erzielen lässt.*leicht zu erreichen, teuer oder außer Reichweite/s,
    "frontierIntro must preserve the ordered systems, budget frontier, and goal feasibility explanation",
  );
  assert.match(
    LOCALES.de.frontierMethod,
    /jede Kombination aus Solarmodulen und Batterien.*groben Raster.*stündlichen Wetterdaten.*von keinem günstigeren System übertroffen.*DIY-Preis inklusive Lieferung/s,
    "frontierMethod must preserve the sweep, comparison, and landed DIY price basis",
  );
});

test("BACK-TRANSLATION: sizing guidance stays complete in Arabic and German", () => {
  const ar = LOCALES.ar;
  for (const key of [
    "quickBillStarts",
    "gridSizingDescription",
    "offgridSizingHeading",
    "offgridSizingDescription",
    "monthlyBillInputOption",
    "presetWeekendCabin",
  ]) {
    assert.match(ar[key], /[\u0600-\u06ff]/u, `ar.${key} must contain Arabic text`);
    assert.doesNotMatch(ar[key], /\?{2,}/, `ar.${key} contains corrupted question marks`);
  }

  assert.match(ar.quickBillStarts, /\{bill\}.*\{kwh\}/);
  assert.match(ar.quickBillStarts, /احسب نظامي/);
  assert.match(ar.runBtnReady, /احسب نظامي/);
  assert.match(ar.quickBillStarts, /منزلق خفض الفاتورة.*النتائج/);
  assert.match(ar.gridSizingDescription, /فاتورتك الشهرية للكهرباء.*موقعك.*احسب نظامي/);
  assert.match(ar.gridSizingDescription, /الطاقة الشمسية والبطاريات.*كيميائيات البطاريات.*20 عامًا.*شراء المعدات بالجملة/);
  assert.match(ar.offgridSizingHeading, /نظامك الشمسي.*بطاريتك.*خارج الشبكة/);
  assert.match(ar.offgridSizingDescription, /كوخ.*شاحنة تخييم.*طاقة احتياطي.*منزل ريفي/);
  assert.match(ar.offgridSizingDescription, /استهلاكك اليومي.*الأجهزة.*بيانات الطقس بالساعة.*احتياجاتك/);
  assert.match(ar.monthlyBillInputOption, /أعرف فاتورتي الكهربائية الشهرية/);
  assert.match(ar.presetWeekendCabin, /كوخ.*عطلة نهاية الأسبوع/);
  assert.notEqual(ar.presetWeekendCabin, LOCALES.pt.presetWeekendCabin);

  assert.match(LOCALES.de.firstRunNote, /Beim ersten Start.*2 MB.*Satelliten-Wetterdaten heruntergeladen.*im Browser zwischengespeichert/);
});

test("BANNED: reintroducing any known-bad value makes the gate fail", () => {
  // Run the gate against a THROWAWAY COPY of the repo, never the real working
  // tree: this test deliberately writes a broken dictionary, and a test that
  // mutates the checkout it runs in is the race that cost three CI cycles on
  // this branch before (see scripts/lib/mutation-lock.mjs).
  const sandbox = mkdtempSync(join(tmpdir(), "beco-i18n-banned-"));
  // Copy the locale JSON into a throwaway tree before mutating any values.
  mkdirSync(join(sandbox, "assets"), { recursive: true });
  cpSync(LOCALES_DIR, join(sandbox, "assets", "i18n"), { recursive: true });
  const script = `
    import { readdirSync, readFileSync } from "node:fs";
    import { fileURLToPath } from "node:url";
    import { join } from "node:path";
    const localeDir = fileURLToPath(new URL("./assets/i18n/", import.meta.url));
    const langs = readdirSync(localeDir).filter((name) => name.endsWith(".json") && name !== "script-directions.json").map((name) => name.slice(0, -5));
    const LOCALES = Object.fromEntries(langs.map((lang) => [lang, JSON.parse(readFileSync(join(localeDir, lang + ".json"), "utf8"))]));
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
  const goodPath = join(LOCALES_DIR, "ar.json");
  const sandboxArabicPath = join(sandbox, "assets", "i18n", "ar.json");
  const good = readFileSync(goodPath, "utf8");
  for (const [ok, bad] of MUTATIONS) {
    if (!good.includes(ok)) continue;
    writeFileSync(sandboxArabicPath, good.replace(ok, bad), "utf8");
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
  writeFileSync(sandboxArabicPath, good, "utf8");
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
    /data-i18n="footerAboutPre"[^>]*>[\s\S]{0,200}?<strong(?=[^>]*data-i18n="operatorName")[^>]*>Lucas Ballek<\/strong>[\s\S]{0,200}?data-i18n="footerAboutPost"/,
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
    /data-i18n="heroIntro"[\s\S]{0,900}?<\/span\s*>\s*<strong(?=[^>]*data-i18n="operatorName")[^>]*>Lucas Ballek<\/strong>/,
    "heroIntro must end before the <strong>, not wrap it",
  );
});

test("PROSE: the detector catches every unkeyed phrase on a locale surface", () => {
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
  // A hook covers its own subtree only; adjacent unkeyed copy remains visible.
  assert.equal(
    unkeyedProse(
      `<p><span data-i18n="heroIntro">Already translated.</span> ${PROSE}</p>`,
    ).length,
    1,
    "a translated child cannot exempt an unkeyed sibling phrase",
  );
  // The exemptions: not prose, and too short to be prose.
  assert.equal(
    unkeyedProse("<p>5 m² · 12 kWh · 3.5 %</p>").length,
    0,
    "units are not prose",
  );
  assert.equal(
    unkeyedProse("<p>3 A</p>").length,
    0,
    "a numeric value and amperes are unit-only",
  );
  assert.equal(
    unkeyedProse("<p>A day</p>").length,
    1,
    "ordinary English cannot pass as two unit symbols",
  );
  assert.equal(
    unkeyedProse("<p>Send</p>").length,
    1,
    "short labels are copy and must carry a hook",
  );
  assert.equal(unkeyedProse("<h2>Leaked heading</h2>").length, 1);
  assert.equal(
    unkeyedProse("<span>Leaked inline prose</span>").length,
    1,
    "inline prose in spans must be checked too",
  );
  assert.equal(unkeyedProse("<a>Read more</a>").length, 1);
  assert.equal(unkeyedProse("<button>Install app</button>").length, 1);
  assert.equal(unkeyedProse("<div>Location step</div>").length, 1);
  assert.equal(unkeyedProse("<option>Choose a location</option>").length, 1);
  assert.equal(unkeyedProse("").length, 0, "empty markup has no prose");
  assert.ok(
    unkeyedProse("<main>Leak directly under main remains English.</main>").some(
      (block) => block.tag === "main",
    ),
    "bare main text must be checked",
  );
  assert.ok(
    unkeyedProse("<body>Leak directly under body remains English.</body>").some(
      (block) => block.tag === "body",
    ),
    "bare body text must be checked",
  );
  assert.ok(
    unkeyedProse(
      '<main><span data-i18n=label>Traduit</span>Adjacent English copy leaks.</main>',
    ).some((block) => block.text === "Adjacent English copy leaks."),
    "a translated inline child must not hide following main text",
  );
  assert.ok(
    unkeyedProse(
      '<main><p data-i18n=caption>Traduit<section>Leaked fallback after the implied paragraph close.</section></main>',
    ).some((block) => block.text.includes("Leaked fallback")),
    "an implied paragraph close must expose following structural text",
  );
  assert.deepEqual(
    unkeyedProse(
      '<main><p data-i18n=caption>Texte traduit</p><section>BigEnergyCo</section><aside>3 kWh</aside></main>',
    ),
    [],
    "translated subtrees, standalone brands, and unit-only content are allowed",
  );
  assert.equal(
    unkeyedProse(`<button data-i18n-aria-label="close">${PROSE}</button>`)
      .length,
    1,
    "an aria-label translation does not cover the visible button text",
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
    false,
    "a hook alone does not declare the whole page as a translated surface",
  );
});

test("PROSE: only explicit locale-runtime surfaces are checked", () => {
  assert.equal(
    claimsTranslation('<main data-i18n-surface="home"></main>'),
    true,
  );
  assert.equal(claimsTranslation('<select id="langSelect"></select>'), true);
  assert.equal(claimsTranslation('<span data-i18n="x"></span>'), false);
  assert.equal(claimsTranslation('<input data-i18n-placeholder="x">'), false);
  assert.equal(
    claimsTranslation("<p>Plain English prose, with no hook at all.</p>"),
    false,
  );
});

test("LOCALE GATE: equal English prose is rejected; units and site brands are allowed", () => {
  const locales = {
    en: {
      leakedHomeCopy: "Works worldwide",
      powerUnit: "~{w} W",
      siteBrand: "BigEnergyCo",
      priceTemplate: "~{amount} / {unit}",
      sectionNumber: "5",
      operatorName: "Lucas Ballek",
      contactEmail: "lucas@example.com",
    },
    es: {
      leakedHomeCopy: "Works worldwide",
      powerUnit: "~{w} W",
      siteBrand: "BigEnergyCo",
      priceTemplate: "~{amount} / {unit}",
      sectionNumber: "5",
      operatorName: "Lucas Ballek",
      contactEmail: "lucas@example.com",
    },
  };
  assert.deepEqual(untranslatedLocaleValues(locales), ["es.leakedHomeCopy"]);
  locales.es.leakedHomeCopy = "Funciona en todo el mundo";
  assert.deepEqual(untranslatedLocaleValues(locales), []);
});

test("PROSE: leaked home-page copy makes the strict gate red", () => {
  const src = readFileSync(join(ROOT, "scripts", "check-i18n.mjs"), "utf8");
  assert.doesNotMatch(
    src,
    /PROSE_CEILING/,
    "the gate must not accept a numeric leak budget",
  );
  assert.match(
    src,
    /if \(proseFindings\.length \|\| attributeFindings\.length\)/,
    "any finding must fail the gate",
  );

  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.equal(
    claimsTranslation(html),
    true,
    "the calculator is an explicit locale surface",
  );
  assert.match(
    html,
    /data-i18n-slot="control"/,
    "translated mode labels must preserve their live controls",
  );
  assert.match(
    html,
    /data-i18n-slot="noticeLead"/,
    "multi-part translated notices must preserve hooked rich-text slots",
  );
  assert.deepEqual(
    unkeyedProse(html),
    [],
    "localized home copy must have no uncovered prose",
  );
  assert.deepEqual(
    unkeyedCopyAttributes(html),
    [],
    "localized home accessibility copy must have no uncovered prose attributes",
  );

  const leaked = html.replace('data-i18n="sizingSectionIntro"', "");
  assert.ok(
    unkeyedProse(leaked).some((block) =>
      block.text.startsWith("Enter your location"),
    ),
    "removing the home intro hook must be detected as an English leak",
  );
  const leakedButton = html.replace('data-i18n-title="socZoomFullTitle"', "");
  assert.ok(
    unkeyedCopyAttributes(leakedButton).some(
      (attribute) => attribute.text === "Full 5-year simulation",
    ),
    "removing a title hook must be detected as an untranslated home copy leak",
  );
  const leakedInline = html.replace('data-i18n="simpleModeNumbers"', "");
  assert.ok(
    unkeyedProse(leakedInline).some((block) =>
      block.text.startsWith("just the key numbers"),
    ),
    "removing an inline hook must expose the formerly missed home-page span",
  );
  const leakedMain = html.replace(
    "</main>",
    "<section>Home page fallback copy has no locale key.</section></main>",
  );
  assert.ok(
    unkeyedProse(leakedMain).some((block) =>
      block.text.includes("Home page fallback copy"),
    ),
    "new unkeyed prose under a structural home-page container must be detected",
  );
});

test("PROSE: visible copy and accessible attributes require their own translation hooks", () => {
  assert.deepEqual(
    unkeyedCopyAttributes(
      '<button title="More details" aria-label="Open details"></button>',
    ),
    [
      { tag: "button", attribute: "title", text: "More details", start: 0 },
      {
        tag: "button",
        attribute: "aria-label",
        text: "Open details",
        start: 0,
      },
    ],
  );
  assert.deepEqual(
    unkeyedCopyAttributes(
      '<input placeholder="Enter a city" data-i18n-aria-label="cityLabel">',
    ),
    [
      {
        tag: "input",
        attribute: "placeholder",
        text: "Enter a city",
        start: 0,
      },
    ],
  );
  assert.deepEqual(
    unkeyedCopyAttributes(
      '<button title="Details" data-i18n-title="details" aria-label="Open" data-i18n-aria-label="open"></button>',
    ),
    [],
  );
});
