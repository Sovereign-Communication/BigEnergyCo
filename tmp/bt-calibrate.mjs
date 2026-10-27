// Scratch: sensitivity calibration of the divergence funnel on SYNTHETIC
// injections (not the sealed seeded controls — positions stay unknown).
// A seeded corruption rides the pipeline locale-string -> MT -> back-English,
// so the simulation corrupts the BACK side the way the pipeline would:
//   figure-drop  -> the digits vanish from the back-rendering
//   meaning-drop -> the back-rendering keeps only the first sentence
//   untranslated -> the locale column is English, so the back-rendering is the
//                  English source itself
import { readFileSync } from "node:fs";

const src = readFileSync("tmp/bt-funnel.mjs", "utf8");
const body = src
  .split("for (const loc of LOCS)")[0]
  .replace('import { readFileSync, writeFileSync } from "node:fs";', "");
const metrics = eval(body + "; metrics");

const LOCS = ["es", "pt", "fr", "de", "nl", "ar"];
const res = {
  "figure-drop": { hit: 0, miss: 0 },
  "meaning-drop": { hit: 0, miss: 0 },
  untranslated: { hit: 0, miss: 0 },
  clean: { fp: 0, tn: 0 },
};

for (const loc of LOCS) {
  const backMap = JSON.parse(readFileSync(`tmp/bt-back-${loc}.json`, "utf8"));
  const rows = readFileSync(`tmp/bt-${loc}.txt`, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [id, key, en, locv] = l.split("\t");
      return { id, key, en, locv: locv.replace(/\\n/g, "\n") };
    })
    .filter((r) => backMap[r.id] !== undefined);
  const step = Math.max(1, Math.floor(rows.length / 25));
  for (let i = 0; i < rows.length; i += step) {
    const r = rows[i];
    const back = backMap[r.id];
    if (/\d/.test(r.en)) {
      const backFig = back.replace(/\d[\d.,]*/g, "").replace(/\s{2,}/g, " ");
      res["figure-drop"][metrics(r, backFig).flags.length ? "hit" : "miss"]++;
    }
    if (/(?<=[.!?])\s+\S/.test(back.trim())) {
      const backCut = back.trim().split(/(?<=[.!?])\s+/)[0];
      res["meaning-drop"][metrics(r, backCut).flags.length ? "hit" : "miss"]++;
    }
    res["untranslated"][
      metrics({ ...r, locv: r.en }, r.en).flags.length ? "hit" : "miss"
    ]++;
    res["clean"][metrics(r, back).flags.length ? "fp" : "tn"]++;
  }
}
console.log(JSON.stringify(res, null, 1));
