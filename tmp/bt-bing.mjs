// Scratch instrument (not committed; per ISSUE_287_TRANSLATION_PATH.md §3).
// Machine back-translation via Microsoft's Bing translator endpoint
// (ttranslatev3 with the page's abuse-prevention key/token), locale -> en.
// The full corpus goes through ONE engine (the earlier Google gtx partial pass
// hit an IP rate-limit block and is discarded so the instrument stays uniform).
// Long strings translate in sentence chunks and are joined (documented in the
// record). Cache is flushed per string, so a re-run resumes where it stopped.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const LOCS = ["es", "pt", "fr", "de", "nl", "ar"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };

let auth = null;
async function refreshAuth() {
  const res = await fetch("https://www.bing.com/translator", {
    headers: UA,
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  const keyM = html.match(/params_AbusePreventionHelper = \[(\d+),"([^"]+)"/);
  const igM = html.match(/IG:"([^"]+)"/);
  const iidM = html.match(/data-iid="([^"]+)"/);
  if (!keyM || !igM) throw new Error("no key/token in translator page");
  auth = {
    key: keyM[1],
    token: keyM[2],
    url:
      "https://www.bing.com/ttranslatev3?isVertical=1&&IG=" +
      igM[1] +
      "&IID=" +
      (iidM ? iidM[1] : "translator.5023.1"),
  };
}

async function tr(text, from, attempt = 0) {
  if (!auth) await refreshAuth();
  try {
    const res = await fetch(auth.url, {
      method: "POST",
      headers: {
        ...UA,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        fromLang: from,
        to: "en",
        text,
        token: auth.token,
        key: auth.key,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (res.status === 400 || res.status === 401) {
      auth = null;
      if (attempt < 3) return tr(text, from, attempt + 1);
      throw new Error("HTTP " + res.status);
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    return j[0].translations[0].text;
  } catch (e) {
    if (attempt < 3) {
      auth = null;
      await sleep(1500);
      return tr(text, from, attempt + 1);
    }
    return "##ENGINE-ERROR## " + e.message;
  }
}

const chunks = (s, max = 900) => {
  if (s.length <= max) return [s];
  const parts = [];
  let cur = "";
  for (const seg of s.split(/(?<=[.!?])\s+/)) {
    if ((cur + " " + seg).length > max && cur) {
      parts.push(cur);
      cur = seg;
    } else cur = cur ? cur + " " + seg : seg;
  }
  if (cur) parts.push(cur);
  return parts;
};

for (const loc of LOCS) {
  const cachePath = `tmp/bt-bing-${loc}.json`;
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
  console.log(loc, "todo:", rows.length);
  for (const row of rows) {
    const parts = chunks(row.locv.replace(/\n/g, " "));
    const outs = [];
    for (const p of parts) outs.push(await tr(p, loc));
    out[row.id] = outs.join(" ");
    writeFileSync(cachePath, JSON.stringify(out));
    await sleep(700);
  }
  console.log(loc, "COMPLETE", Object.keys(out).length);
}
console.log("all locales complete");
