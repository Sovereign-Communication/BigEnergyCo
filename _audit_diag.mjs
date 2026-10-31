// Diagnostic: where does the English spec text live on the es home page,
// and what does the heatmap page do about locale? Read-only probe.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const REPO = "C:/tmp/be-usecase-20261028";
const R = pathToFileURL(REPO).href + "/";

const { serveStatic } = await import(`${R}scripts/serve-static.mjs`);
const { start } = await import(`${R}scripts/smoke/runtime.mjs`);
const { createActions } = await import(`${R}scripts/smoke/actions.mjs`);

const srv = await serveStatic({ dir: `${REPO}/_pages_smoke` });
const base = `http://127.0.0.1:${srv.port}/`;
const ctx = await start();
await ctx.send("Page.enable");
const actions = createActions(ctx);
const { evaluate } = ctx;

await actions.navigate(base);
await evaluate(`localStorage.setItem("beco-lang","es")`);

// 1. English spec string: which node holds it, and is it rendered?
await actions.navigate(base);
const probe = await evaluate(`(() => {
  const en = "Brand new Grade-A prismatic LFP cells. 16S configuration per pack (51.2V nominal).";
  const hits = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.children.length) continue;
      const t = (el.textContent || "").trim();
      if (t.includes("Brand new Grade-A prismatic")) {
        const cs = getComputedStyle(el);
        hits.push({
          tag: el.tagName, id: el.id, cls: el.className && String(el.className).slice(0,60),
          display: cs.display, visibility: cs.visibility,
          inInnerText: document.body.innerText.includes(t.slice(0, 40)),
          lang: el.closest("[lang]")?.getAttribute("lang") || null,
          text: t.slice(0, 70),
        });
      }
    }
  };
  walk(document);
  return {
    hits,
    htmlLang: document.documentElement.lang,
    esPresent: document.body.innerText.includes("Celdas prismáticas LFP nuevas"),
    enPresent: document.body.innerText.includes("Brand new Grade-A prismatic"),
  };
})()`);
console.log("HOME es probe:", JSON.stringify(probe, null, 1));

// 2. Heatmap page locale behavior
await actions.navigate(`${base}solar-heatmap/`);
const heat = await evaluate(`(() => ({
  htmlLang: document.documentElement.lang,
  dir: document.documentElement.dir,
  hasLangSwitch: !!document.querySelector("[id*=lang], select[id*=lang], #langSelect"),
  bodySample: document.body.innerText.slice(0, 200),
  localeHookCount: (document.body.innerHTML.match(/data-i18n|data-lang-key/g) || []).length,
}))()`);
console.log("HEATMAP probe:", JSON.stringify(heat, null, 1));

await ctx.close();
await srv.close();
process.exit(0);
