// Scratch instrument (not committed). The divergence funnel: mechanical metrics
// DIRECT ATTENTION ONLY (never verdicts) — figure survival, negation parity,
// units/placeholders, length ratio, content-word overlap, passthrough identity.
// Rows that trip any metric (plus nothing else) go to the reviewer's read.
import { readFileSync, writeFileSync } from "node:fs";

const LOCS = ["es", "pt", "fr", "de", "nl", "ar"];
const NEG = /\b(not|no|never|without|neither|nothing|non-|cannot|can't|won't|don't|isn't|aren't|doesn't|don)\b/i;
const UNITS = /(?:\d[\d.,]*\s*)(?:%|°|m²|kWh|kW|W\b|MB|GB|A\b|V\b|h\/|yr|year|mo)/gi;

// Numbers normalized so 3,000 == 3000 and 1.500 == 1,500 style differences do
// not trip the figure class; only a genuinely different figure set trips it.
function nums(s) {
  return (s.match(/\d[\d.,]*/g) || [])
    .map((n) => n.replace(/(?<=\d),(?=\d{3}(\D|$))/g, "").replace(/(?<=\d)\.(?=\d{3}(\D|$))/g, ""))
    .map((n) => n.replace(/^0+(?=\d)/, ""))
    .sort();
}

function metrics(row, back) {
  const flags = [];
  const a = nums(row.en).join(",");
  const b = nums(back).join(",");
  if (a !== b) flags.push("figure");
  if (NEG.test(row.en) !== NEG.test(back)) flags.push("negation");
  const su = (row.en.match(UNITS) || []).map((s) => s.replace(/\s+/g, "").toLowerCase());
  const bu = (back.match(UNITS) || []).map((s) => s.replace(/\s+/g, "").toLowerCase());
  for (const u of su) if (!bu.some((b) => b.includes(u.replace(/^\d[\d.,]*/, "")))) { flags.push("unit"); break; }
  if (/%|\$|€|£|￥/.test(row.en) !== /%|\$|€|£|￥/.test(back)) flags.push("symbol");
  // A faithful translation ofen back-translates to the identical English:
  // that is fidelity, not a defect. The defect class is the locale column
  // still being English (never translated). Short strings skip length/overlap
  // — phrase synonyms differ word-by-word without a meaning change.
  if (row.locv.trim() === row.en.trim()) flags.push("untranslated");
  if (back === row.locv) flags.push("engine-noop");
  const short = row.en.length < 40;
  const ratio = back.length / Math.max(1, row.en.length);
  if (!short && (ratio < 0.72 || ratio > 1.9)) flags.push("length");
  const sents = (s) => (s.match(/[.!?]["')\]]?(\s|$)/g) || []).length;
  if (!short && sents(row.en) !== sents(back)) flags.push("sentences");
  const words = (s) => (s.toLowerCase().match(/[a-zà-ÿ\u0600-\u06ff]{3,}/g) || []);
  const sw = new Set(words(row.en));
  const bw = new Set(words(back));
  const inter = [...sw].filter((w) => bw.has(w)).length;
  const jac = inter / Math.max(1, sw.size + bw.size - inter);
  if (!short && jac < 0.22) flags.push("overlap");
  if (back.startsWith("##ENGINE-ERROR##")) flags.push("engine");
  return { flags, ratio: ratio.toFixed(2), jac: jac.toFixed(2) };
}

for (const loc of LOCS) {
  // BT_BACK selects the back-translation corpus: the Google line (default, the
  // partial 1,760-row run) or the uniform Bing line (bt-bing) that replaces it.
  const backPrefix = process.env.BT_BACK || "bt-back";
  const backMap = JSON.parse(
    readFileSync(`tmp/${backPrefix}-${loc}.json`, "utf8"),
  );
  const rows = readFileSync(`tmp/bt-${loc}.txt`, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [id, key, en, locv] = l.split("\t");
      return { id, key, en, locv: locv.replace(/\\n/g, "\n") };
    });
  const out = [];
  let skipped = 0;
  for (const row of rows) {
    const back = backMap[row.id];
    if (back === undefined) {
      skipped++;
      continue;
    }
    const m = metrics(row, back);
    if (m.flags.length) {
      out.push(
        `${row.id}\t${row.key}\t[${m.flags.join(",")}; r=${m.ratio}; j=${m.jac}]\n  EN : ${row.en}\n  ${loc} : ${row.locv}\n  BT : ${back}`,
      );
    }
  }
  writeFileSync(`tmp/bt-funnel-${loc}.txt`, out.join("\n\n"), "utf8");
  console.log(loc, "rows:", rows.length, "skipped:", skipped, "funnel:", out.length);
}
