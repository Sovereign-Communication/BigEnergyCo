// Scratch instrument (not committed; per ISSUE_287_TRANSLATION_PATH.md §3).
// Machine back-translation instrument: every worksheet row's locale string is
// sent to an independent public MT engine (Google gtx, sl=locale -> en) and the
// English back-rendering is stored. The instrument's admissibility is decided
// FIRST on the blinded seeded controls (bt-answers.json stays sealed until
// verdicts are committed); only then do its corpus outputs count as evidence.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const LOCS = ["es", "pt", "fr", "de", "nl", "ar"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tr(text, sl) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
        sl +
        "&tl=en&dt=t&q=" +
        encodeURIComponent(text);
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      return (j[0] || []).map((seg) => seg[0]).join("");
    } catch (e) {
      if (attempt === 4) return "##ENGINE-ERROR## " + e.message;
      await sleep(500 * (attempt + 1));
    }
  }
}

const jobs = LOCS.map(async (loc) => {
  const cachePath = `tmp/bt-back-${loc}.json`;
  const out = existsSync(cachePath)
    ? JSON.parse(readFileSync(cachePath, "utf8"))
    : {};
  const rows = readFileSync(`tmp/bt-${loc}.txt`, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [id, key, en, locv] = l.split("\t");
      return { id, key, en, locv };
    });
  let n = 0;
  for (const row of rows) {
    if (out[row.id] !== undefined) continue;
    out[row.id] = await tr(row.locv.replace(/\\n/g, "\n"), loc);
    if (++n % 5 === 0) {
      writeFileSync(cachePath, JSON.stringify(out));
      console.log(loc, n, "translated");
    }
    await sleep(120);
  }
  writeFileSync(cachePath, JSON.stringify(out));
  console.log(loc, "COMPLETE", Object.keys(out).length);
});

await Promise.all(jobs);
console.log("all locales complete");
