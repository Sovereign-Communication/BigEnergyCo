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
await actions.navigate(base);
const out = await evaluate(`(() => {
  const el = document.querySelector('[data-i18n="lfpCells"]');
  const r = { found: !!el, html: el ? el.outerHTML.slice(0,200) : null,
              hasEsKey: null, dictProbe: null };
  if (el) {
    // Does the live dict have the key?
    r.dictProbe = "n/a";
    // Re-run the applier's own logic to see if a re-apply would fix it:
    import("/assets/js/shared/i18n.js").then(()=>{}).catch(()=>{});
  }
  // Check siblings: how many [data-i18n] elements still show English?
  const enSamples = ["Brand new Grade-A", "Smart active balancing", "20kA AIC", "Belleville spring washer"];
  r.staleCount = enSamples.filter(s => document.body.innerText.includes(s)).length;
  r.hasEsLfp = document.body.innerText.includes("Celdas prismáticas LFP");
  return r;
})()`);
console.log("probe2:", JSON.stringify(out, null, 1));
await ctx.close(); await srv.close(); process.exit(0);
