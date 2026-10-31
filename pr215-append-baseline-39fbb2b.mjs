import fs from "node:fs";
const path = "docs/plan/LEDGER.jsonl";
const raw = fs.readFileSync(path, "utf8");
const rows = raw.split(/\r?\n/).filter((line) => line.trim() !== "").map((line) => JSON.parse(line));
const candidateSha = "39fbb2b6c5bab5fa2028660c9f6e578583e25e7b";
if (rows.some((row) => row.kind === "baseline" && row.ref === "P0.4" && row.evidence?.sha === candidateSha && row.evidence?.metrics?.home_document?.value === 19426)) throw new Error("Candidate baseline already present; refusing duplicate");
const row = {
  ts: "2026-10-17",
  kind: "baseline",
  ref: "P0.4",
  summary: "Owner-approved up to 2 KB first-load HTML expansion for PR #215 visible example/FAQ. The home document measures 19,426 Brotli bytes, +529 from the previous 18,897 baseline and below the 30,720-byte absolute cap; accepted as the new home-document ratchet baseline.",
  evidence: {
    pr: 215,
    sha: candidateSha,
    measured_by: "scripts/check-byte-budgets.mjs --stage _pages_staging (Brotli q11)",
    metrics: {
      home_document: { value: 19426, limit: 30720, unit: "bytes", status: "measured", was: 18897, delta: 529 },
    },
  },
};
fs.appendFileSync(path, (raw.endsWith("\n") ? "" : "\n") + JSON.stringify(row) + "\n", "utf8");
console.log("Appended P0.4 home_document baseline: 19,426 bytes (previous 18,897; +529).");