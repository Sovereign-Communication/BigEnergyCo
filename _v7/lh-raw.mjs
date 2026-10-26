// Throwaway: raw, UNTHRESHOLDED Lighthouse readings on the staged build.
// No floors, no comparison, no verdict — this exists to produce the numbers the
// thresholds will then be declared from.
import lighthouse from "lighthouse";
import { serveStatic } from "../scripts/serve-static.mjs";
import { resolve } from "node:path";

const STAGE = process.argv[2] || "_pages_a11y";
const PAGES = (process.argv[3] || "index.html").split(",");
const FFS = (process.argv[4] || "mobile").split(",");
const RUNS = Number(process.argv[5] || 1);
const ONLY_CATS = ["performance", "accessibility", "best-practices", "seo"];

const srv = await serveStatic({ dir: resolve(STAGE), port: 0 });
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const out = [];

for (const page of PAGES) {
  for (const ff of FFS) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const t0 = Date.now();
      const r = await lighthouse(
        new URL(page, srv.url).href,
        {
          port: chromePath,
          output: "json",
          logLevel: "error",
          onlyCategories: ONLY_CATS,
          formFactor: ff,
          screenEmulation: {
            mobile: ff === "mobile",
            width: ff === "mobile" ? 390 : 1350,
            height: ff === "mobile" ? 844 : 940,
            deviceScaleFactor: ff === "mobile" ? 2.75 : 1,
            disabled: false,
          },
          throttlingMethod: "simulate",
        },
        undefined,
      );
      const lhr = r.lhr;
      const scores = {};
      for (const c of ONLY_CATS) scores[c] = lhr.categories[c]?.score ?? null;
      const a = lhr.audits;
      runs.push({
        scores,
        lcp_s: a["largest-contentful-paint"]?.numericValue / 1000 ?? null,
        cls: a["cumulative-layout-shift"]?.numericValue ?? null,
        tbt_ms: a["total-blocking-time"]?.numericValue ?? null,
        fcp_s: a["first-contentful-paint"]?.numericValue / 1000 ?? null,
        speed_index_s: a["speed-index"]?.numericValue / 1000 ?? null,
        si_s: a["interactive"]?.numericValue / 1000 ?? null,
        seconds: Math.round((Date.now() - t0) / 100) / 10,
      });
    }
    out.push({ page, formFactor: ff, runs });
    const last = runs[runs.length - 1];
    console.log(
      `${page} ${ff}  ` +
        ONLY_CATS.map((c) => `${c}=${last.scores[c]}`).join(" ") +
        `  lcp=${last.lcp_s?.toFixed(2)}s cls=${last.cls?.toFixed(3)} ` +
        `tbt=${Math.round(last.tbt_ms)}ms fcp=${last.fcp_s?.toFixed(2)}s ` +
        `si=${last.speed_index_s?.toFixed(2)}s  (${last.seconds}s/run)`,
    );
  }
}

await srv.close();
console.log("\n===RAW===");
console.log(JSON.stringify(out, null, 1));
