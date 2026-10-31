import fs from "node:fs";

const path = process.argv[2];
const row = {
  ts: "2026-10-22",
  kind: "note",
  ref: "P9.5",
  summary:
    "PR #212 corrects unsupported DIY price comparisons for one existing battery article. A 2026-10-22 Docan listing snapshot gives 16 REPT 280 Ah cells at $60 each plus an Apex/JK box listing at $365: $1,325 divided by 11.47 usable kWh is about $116 per usable kWh before freight and tax. This is one inquiry-only supplier snapshot; the owner-supplied $80-$120 band remains labeled as a planning assumption. This is partial audit work; P9.5 remains open.",
  evidence: {
    pr: 212,
    sha: "4ea9d47740536510be0f4be3b16c41557f8681fe",
    scope: "one article's DIY LFP pricing claims and FAQ",
    snapshot_date: "2026-10-22",
    sources: [
      "https://www.docanpower.com/rept-280ah-prismatic-cell",
      "https://www.docanpower.com/s3-diy-box-jk-bms-v19",
    ],
    arithmetic: {
      cell_count: 16,
      cell_price_usd: 60,
      kit_price_usd: 365,
      nameplate_kwh: 14.336,
      usable_fraction: 0.8,
      usable_kwh: 11.4688,
      price_per_usable_kwh_usd: 115.53,
    },
    test: "tests/blog-diy-price-override.test.mjs; 2/2 focused cases",
  },
};
const text = fs.readFileSync(path, "utf8");
const eol = text.includes("\r\n") ? "\r\n" : "\n";
const prefix = text.endsWith("\n") ? "" : eol;
fs.appendFileSync(path, prefix + JSON.stringify(row) + eol, "utf8");
const lines = fs.readFileSync(path, "utf8").trimEnd().split(/\r?\n/);
JSON.parse(lines.at(-1));
console.log("Appended one P9.5 note row.");
