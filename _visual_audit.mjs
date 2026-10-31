// Visual audit: render key pages x 7 locales x mobile/desktop, capture
// screenshots, and assert the mission's checklist per cell:
//   - locale applied (html lang), chooser labels equal the locale's own
//     strings (English leak check), no raw i18n key names in visible text,
//     use-case chooser revealed with a non-empty blurb, zero console/page
//     errors during the visit.
// Lane script; writes evidence only, touches no repo file.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REPO = "C:/tmp/be-usecase-20261028";
const R = pathToFileURL(REPO).href + "/";
const OUT = "C:/tmp/_visual_audit";
const LOCALES_LIST = ["en", "es", "pt", "fr", "de", "nl", "ar"];
const WIDTHS = [
  { name: "mobile", w: 390, h: 844 },
  { name: "desktop", w: 1440, h: 900 },
];
const PAGES = [
  { id: "home", path: "" },
  { id: "heatmap", path: "solar-heatmap/" },
];

mkdirSync(OUT, { recursive: true });

// Stage the allowlisted build exactly like smoke-local does.
execFileSync(
  process.execPath,
  [
    `${REPO}/scripts/deploy-pages-local.mjs`,
    "--check",
    "--stage",
    "_pages_smoke",
  ],
  { stdio: "pipe" },
);

const { start } = await import(`${R}scripts/smoke/runtime.mjs`);
const { serveStatic } = await import(`${R}scripts/serve-static.mjs`);
const { createActions, jevFetchStubSource } = await import(
  `${R}scripts/smoke/actions.mjs`
);
const { LOCALES } = await import(`${R}assets/js/shared/locales.js`);
const { claimsTranslation } = await import(`${R}scripts/lib/gates.mjs`);
const { readFileSync: rf } = await import("node:fs");
const claimsStatic = (page) =>
  claimsTranslation(rf(`${REPO}/${page.path}index.html`, "utf8"));
const { USE_CASE_IDS, USE_CASES } = await import(
  `${R}assets/js/sizing/usecases.js`
);

const srv = await serveStatic({ dir: `${REPO}/_pages_smoke` });
const base = `http://127.0.0.1:${srv.port}/`;
const ctx = await start();
await ctx.send("Page.enable");
const actions = createActions(ctx);
const { evaluate, send } = ctx;

const KEY_TOKENS =
  /\b(?:useCase[A-Z]\w*|modeTitle\w*|modeDesc\w*|\w+BlurbKey|labelKey|metric\w*Key|statusWorks|statusPartial)\b/;

const results = [];
const fail = (cell, what, detail) =>
  results.push({ cell, ok: false, what, detail: String(detail).slice(0, 300) });
const pass = (cell, what, detail = "") =>
  results.push({ cell, ok: true, what, detail: String(detail).slice(0, 300) });

// Prime the origin so beco-lang can be written before any boot.
await actions.navigate(base);
await ctx.poll(() => evaluate(`!!localStorage`), 5000, 200);

for (const locale of LOCALES_LIST) {
  await evaluate(
    `localStorage.setItem("beco-lang", ${JSON.stringify(locale)})`,
  );
  const en = LOCALES.en;
  const loc = LOCALES[locale] || {};
  for (const page of PAGES) {
    for (const vw of WIDTHS) {
      const cell = `${page.id}/${locale}/${vw.name}(${vw.w})`;
      await send("Emulation.setDeviceMetricsOverride", {
        width: vw.w,
        height: vw.h,
        deviceScaleFactor: 1,
        mobile: vw.name === "mobile",
      });
      const errBefore = ctx.errors.length;
      await actions.navigate(`${base}${page.path}`);
      await evaluate(jevFetchStubSource()).catch(() => {});

      // Scope, per the repo's own rule (check-i18n.mjs rule 9): only pages
      // whose STATIC html claims translation (at least one data-i18n hook)
      // are required to be localized; the other shipped pages are
      // "untranslated by decision, not by oversight". A runtime probe would
      // misjudge this: the JS-injected nav adds hooks to pages that never
      // claimed translation. Checked once per page from the staged source.
      const hookCount = await evaluate(
        `document.querySelectorAll("[data-i18n]").length`,
      );
      if (!claimsStatic(page)) {
        results.push({
          cell,
          ok: true,
          what: "N/A: static html claims no translation — untranslated by decision",
          detail: `runtime hooks=${hookCount} (JS-injected nav is not a claim)`,
        });
        const shot0 = await send("Page.captureScreenshot", { format: "png" });
        writeFileSync(
          `${OUT}/${page.id}-${locale}-${vw.name}.png`,
          Buffer.from(shot0.data, "base64"),
        );
        const newErrs0 = ctx.errors.slice(errBefore);
        if (newErrs0.length === 0)
          results.push({ cell, ok: true, what: "no console/page errors", detail: "" });
        else
          results.push({
            cell,
            ok: false,
            what: "no console/page errors",
            detail: newErrs0.join(" | ").slice(0, 300),
          });
        continue;
      }

      // 1. locale applied
      const lang = await evaluate(`document.documentElement.lang`);
      if (lang === locale) pass(cell, "html lang applied", lang);
      else fail(cell, "html lang applied", `got ${lang}, want ${locale}`);

      // 2. no console/page errors during this visit
      const newErrs = ctx.errors.slice(errBefore);
      if (newErrs.length === 0) pass(cell, "no console/page errors");
      else fail(cell, "no console/page errors", newErrs.join(" | "));

      // 3. visible text checks
      const probe = await evaluate(`(() => {
        const text = document.body.innerText;
        const opts = [...document.querySelectorAll("#useCase option")].map(o => o.textContent.trim());
        const row = document.getElementById("useCaseRow");
        const blurb = (document.getElementById("useCaseBlurb")?.textContent || "").trim();
        const title = document.title;
        return { text, opts, rowRevealed: row ? !row.hidden : null, blurb, title };
      })()`);

      if (page.id === "home") {
        const want = USE_CASE_IDS.map((id) => loc[USE_CASES[id].labelKey]);
        const got = probe.opts;
        const labelsOk =
          got.length === want.length && want.every((w, i) => got[i] === w);
        if (labelsOk)
          pass(cell, "six chooser labels equal the locale's own strings");
        else
          fail(
            cell,
            "six chooser labels equal the locale's own strings",
            JSON.stringify({ got, want }),
          );

        if (probe.rowRevealed === true) pass(cell, "use-case chooser revealed");
        else fail(cell, "use-case chooser revealed", String(probe.rowRevealed));

        if (probe.blurb.length > 0) pass(cell, "use-case blurb non-empty");
        else fail(cell, "use-case blurb non-empty", probe.blurb);
      }

      if (KEY_TOKENS.test(probe.text))
        fail(cell, "no raw i18n key names visible", probe.text.match(KEY_TOKENS)[0]);
      else pass(cell, "no raw i18n key names visible");

      if (locale !== "en") {
        const leaks = [];
        for (const [k, v] of Object.entries(en)) {
          if (typeof v !== "string" || v.length <= 25) continue;
          if (loc[k] === v) continue; // identical by translation choice
          if (probe.text.includes(v)) leaks.push(k);
        }
        if (leaks.length === 0) pass(cell, "no English prose leak");
        else fail(cell, "no English prose leak", leaks.slice(0, 8).join(", "));
      }

      const shot = await send("Page.captureScreenshot", { format: "png" });
      const file = `${OUT}/${page.id}-${locale}-${vw.name}.png`;
      writeFileSync(file, Buffer.from(shot.data, "base64"));
      pass(cell, "screenshot", file);
    }
  }
}

// Reset the profile language (temp profile is discarded anyway) and report.
await evaluate(`localStorage.setItem("beco-lang","en")`).catch(() => {});
await ctx.close();
await srv.close?.();

const bad = results.filter((r) => !r.ok);
const summary = [
  `# Visual audit checklist`,
  ``,
  `Run: ${new Date().toISOString()} | head: ${execFileSync("git", ["-C", REPO, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim()}`,
  `Cells: ${LOCALES_LIST.length} locales x ${PAGES.length} pages x ${WIDTHS.length} widths = ${LOCALES_LIST.length * PAGES.length * WIDTHS.length}`,
  `Checks: ${results.length} | failed: ${bad.length}`,
  ``,
  ...results.map((r) => `${r.ok ? "PASS" : "FAIL"} | ${r.cell} | ${r.what}${r.detail ? " | " + r.detail : ""}`),
].join("\n");
writeFileSync(`${OUT}/checklist.md`, summary + "\n");
console.log(summary.split("\n").slice(0, 6).join("\n"));
if (bad.length) {
  console.log("FAILURES:");
  for (const b of bad) console.log(`  ${b.cell} :: ${b.what} :: ${b.detail}`);
}
process.exit(bad.length ? 1 : 0);
