// Scratch instrument (not committed). Resumes the back-translation after the
// 429 block: waits for the engine to answer again, then translates the
// REMAINING rows in marker-separated batches (<=8 strings per request) at a
// gentle pace. Marker batches fall back to single requests if the segments
// misalign. Cache is flushed every batch, so a re-run resumes where it stopped.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const LOCS = ["es", "pt", "fr", "de", "nl", "ar"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "Mozilla/5.0" };

async function gtx(text, sl, timeout = 20000) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
    sl +
    "&tl=en&dt=t&q=" +
    encodeURIComponent(text);
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeout) });
  if (res.status === 429) return { blocked: true };
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  return { text: (j[0] || []).map((seg) => seg[0]).join("") };
}

function splitMarked(out, n) {
  const parts = out.split(/\s*\[\[\d+\]\]\s*/);
  if (parts.length !== n) return null;
  return parts.map((s) => s.trim());
}

async function waitForEngine() {
  for (;;) {
    try {
      const r = await gtx("hello", "es");
      if (r.text) return true;
    } catch (e) {
      /* keep waiting */
    }
    console.log("blocked or unreachable, waiting 30s…");
    await sleep(30000);
  }
}

await waitForEngine();
console.log("engine answering again");

for (const loc of LOCS) {
  const cachePath = `tmp/bt-back-${loc}.json`;
  const out = existsSync(cachePath)
    ? JSON.parse(readFileSync(cachePath, "utf8"))
    : {};
  const rows = readFileSync(`tmp/bt-${loc}.txt`, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [id, key, en, locv] = l.split("\t");
      return { id, key, en, locv: locv.replace(/\\n/g, "\n") };
    })
    .filter((r) => out[r.id] === undefined);
  console.log(loc, "remaining:", rows.length);
  let i = 0;
  while (i < rows.length) {
    const batch = rows.slice(i, i + 8);
    const q = batch
      .map((r, k) => (k ? `[[${k}]] ` : "") + r.locv.replace(/\n/g, " "))
      .join(" ");
    try {
      const res = await gtx(q, loc);
      if (res.blocked) {
        console.log(loc, "429 mid-run, waiting…");
        await waitForEngine();
        continue;
      }
      const segs = splitMarked(res.text, batch.length);
      if (segs) {
        batch.forEach((r, k) => (out[r.id] = segs[k]));
      } else {
        for (const r of batch) {
          const s = await gtx(r.locv.replace(/\n/g, " "), loc);
          out[r.id] = s.text ?? "##ENGINE-ERROR## misalign-fallback-failed";
          await sleep(400);
        }
      }
    } catch (e) {
      console.log(loc, "batch error:", e.message, "- retrying");
      await sleep(3000);
      continue;
    }
    i += batch.length;
    writeFileSync(cachePath, JSON.stringify(out));
    await sleep(1500);
  }
  console.log(loc, "COMPLETE", Object.keys(out).length);
}
console.log("all locales complete");
