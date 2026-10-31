// Correct evidence/advisor-and-release.json from the committed measurement.
//
// Two claims this script exists to state EXACTLY, because the previous version
// of them was not supported by its own measurement:
//
//   1. BYTE PARITY. The prose said "whole-allowlist byte parity". What
//      scripts/verify-staging.mjs actually compares byte-for-byte is every
//      allowlist entry the surface serves; `_headers` and `_redirects` are
//      platform-special on Cloudflare and are checked as SURFACE RULES (their
//      expected state there is "absent"), never as bytes. So the sentence now
//      carries the compared count and names those two, derived here from the
//      probe artifact and from the same platformSpecialFiles() the verifier
//      uses — not typed from memory.
//
//   2. THE SMOKE VERDICT. The old sentence asserted a verdict in prose. This
//      one is generated from the run that measured it, so it cannot describe a
//      different run than the artifact does. If the measurement is not clean,
//      the script records the verdict it really produced (or the absence of
//      one) rather than a pass.
//
// The script refuses to write a record that overflows the transport clip
// carrying each sentence to the judge (smoke_note 460, every facet line 280;
// both owned by scripts/lib/jev-complete.mjs) and refuses to write one its own
// gate rejects.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ROOT = "C:/tmp/gate-freshness";
const RECORD = `${ROOT}/evidence/advisor-and-release.json`;
const PROBE = `${ROOT}/evidence/production-probe.json`;

// The transport clips, imported from the module that owns them.
const COMPLETE = await import(
  "file:///C:/tmp/gate-freshness/scripts/lib/jev-complete.mjs"
);
const CLIP = { smoke_note: 460, facet: COMPLETE.COMPLETE_FACET_CLIP };
// The same surface-special table the verifier consults, so the two cannot
// disagree about which entries are not compared as bytes.
const { platformSpecialFiles } = await import(
  "file:///C:/tmp/gate-freshness/scripts/lib/stamps.mjs"
);

// The base is the BRANCH TIP (HEAD), i.e. the record as it stands with the
// earlier corrections already in it — not origin/main, which still carries the
// false claims. The fields this script rewrites are rewritten from the fresh
// measurement; every other string in the record is left exactly as committed.
const base = JSON.parse(
  execFileSync("git", ["show", "HEAD:evidence/advisor-and-release.json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).replace(/^\uFEFF/, ""),
);
const probe = JSON.parse(readFileSync(PROBE, "utf8"));
const pages = probe.targets.find((t) => t.name === "pages");
const brand = probe.targets.find((t) => t.name === "brand");
if (!pages || !brand) throw new Error("the probe is missing a probed surface");

const shipped = probe.tree_stamp;
const ledger = readFileSync(`${ROOT}/docs/release-ledger.jsonl`, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l))
  .filter((r) => r && typeof r.stamp === "string");
const ledgerStamp = ledger[ledger.length - 1].stamp;

// ── claim 1: what parity actually covered ───────────────────────────────────
const specials = Object.keys(platformSpecialFiles(pages.surface)).sort();
const compared = pages.files_checked;
const matched = pages.matched;
if (!(compared > 0 && matched === compared))
  throw new Error(
    `the measurement does not show parity (${matched}/${compared}); state it as ` +
      "measured instead of writing this claim",
  );
const specialNames =
  specials.length > 1
    ? `${specials.slice(0, -1).join(", ")} and ${specials[specials.length - 1]}`
    : specials.join("");
const PARITY =
  `${compared} allowlist entries compared byte-for-byte, all identical ` +
  `(${specialNames} are surface rules, not bytes)`;
// The short form for the two facets, where the clip is tightest. It carries the
// same two facts — the compared count and which entries are not compared as
// bytes — in fewer characters.
const PARITY_SHORT =
  `${compared} allowlist entries byte-identical ` +
  `(${specialNames} as surface rules, not bytes)`;

// ── claim 2: the smoke verdicts the run actually produced ───────────────────
// Generated from the run, so the sentence cannot describe a different one.
const smokeVerdict = (() => {
  const p = pages.browser_smoke === true;
  const b = brand.browser_smoke === true;
  if (p && b) return "both smoke legs green";
  if (!p && !b) return "no smoke leg green";
  return p
    ? "Pages' smoke green, the brand's not"
    : "the brand's smoke green, Pages' not";
})();

// ── the corrected fields ────────────────────────────────────────────────────
const SMOKE_NOTE =
  "The browser smoke runs {{smoke_gates_total}} gates; measured this run: " +
  "{{smoke_gates_passed}} pass, {{smoke_gates_failed}} fail. The count is " +
  "written by the gate reporter (scripts/smoke/runtime.mjs), not typed here. " +
  "Production is measured, not asserted: " +
  PARITY +
  "; evidence/production-probe.json carries each surface's smoke verdict.";

const CORRECTNESS =
  "the promote gate refuses to deploy unless staging serves the checkout's " +
  "stamp at full byte parity with the smoke passing. Re-measured live: " +
  `${compared} allowlist entries byte-identical, ${specialNames} as surface ` +
  "rules, not bytes; no ledger release records that build.";


const SEO =
  "sitemap, JSON-LD, metadata, character and canonical checks green; npm run seo " +
  "exit 0 with asset stamp " +
  shipped +
  " and SW cache beco-v108, the bytes this tree ships - " +
  "scripts/check-evidence-freshness.mjs reads both out of the shipped files and " +
  "fails on any other.";

const TESTING = base.facet_evidence.testing;

const RELEASE =
  "releases #141/#142, #144, #146-#148 dated in release-ledger.jsonl. Live: " +
  PARITY_SHORT +
  "; brand serves the app past its challenge (F-44), parity unmeasurable " +
  "(403); " +
  smokeVerdict +
  ".";

const NOTE0 = base.notes[0];

const next = structuredClone(base);
next.smoke_note = SMOKE_NOTE;
next.facet_evidence.correctness = CORRECTNESS;
next.facet_evidence.seo = SEO;
next.facet_evidence.testing = TESTING;
next.facet_evidence.release = RELEASE;
next.notes[0] = NOTE0;

// ── the measured block, derived from the artifact ───────────────────────────
next.production = {
  measured_at: probe.measured_at,
  evidence: "evidence/production-probe.json",
  target: pages.name,
  surface: pages.surface,
  tree_stamp: probe.tree_stamp,
  served_stamp: pages.served_stamp,
  files_checked: pages.files_checked,
  matched: pages.matched,
  browser_smoke: pages.browser_smoke,
  verified: pages.verified,
  unverified_surfaces: probe.targets
    .filter((t) => t.verified !== true)
    .map((t) => t.name)
    .sort(),
  ledger_stamp: ledgerStamp,
  recorded_release: pages.served_stamp === ledgerStamp,
};

const ordered = {};
for (const [k, v] of Object.entries(next)) {
  ordered[k] = v;
  if (k === "smoke_note") ordered.production = next.production;
}

// ── all assertions before anything is written ───────────────────────────────
let bad = 0;
const check = (label, condition, detail) => {
  if (condition) return;
  bad += 1;
  console.error(`PATCH FAILED: ${label}${detail ? ` — ${detail}` : ""}`);
};

const lens = {
  smoke_note: [SMOKE_NOTE, CLIP.smoke_note],
  correctness: [CORRECTNESS, CLIP.facet],
  seo: [SEO, CLIP.facet],
  testing: [TESTING, CLIP.facet],
  release: [RELEASE, CLIP.facet],
};
for (const [field, [text, clip]] of Object.entries(lens))
  check(
    `${field} fits its transport clip`,
    text.length <= clip,
    `${text.length} chars > ${clip}`,
  );

// The count and the two surface-special names this script states are the ones
// the artifact measured — in every field that states parity.
for (const [field, text] of Object.entries({ SMOKE_NOTE, RELEASE, CORRECTNESS }))
  check(
    `${field} carries the measured compared count`,
    text.includes(`${compared} allowlist entries`),
    `expected "${compared} allowlist entries"`,
  );
for (const [field, text] of Object.entries({
  SMOKE_NOTE,
  RELEASE,
  CORRECTNESS,
}))
  check(
    `${field} names both surface-special entries`,
    specials.every((s) => text.includes(s)),
    `expected ${specials.join(", ")}`,
  );

// No string may name a build other than the one this tree ships (rule 2a), and
// the measured block's own numbers are excluded because the gate mirrors them
// against the probe directly.
const leaves = (v, path = "") =>
  typeof v === "string"
    ? [{ path: path || "(record)", text: v }]
    : Array.isArray(v)
      ? v.flatMap((x, i) => leaves(x, `${path}[${i}]`))
      : v && typeof v === "object"
        ? Object.entries(v).flatMap(([k, x]) =>
            leaves(x, path ? `${path}.${k}` : k),
          )
        : [];
for (const { path, text } of leaves(ordered)) {
  if (/^production(\.|\[|$)/.test(path)) continue;
  for (const [tok] of text.matchAll(/\b\d{8}[a-z]\b/g))
    check(
      `${path} names only this tree's build`,
      tok === shipped,
      `states ${tok}, tree ships ${shipped}`,
    );
  for (const [tok] of text.matchAll(/beco-v\d+/g))
    check(`${path} names the shipped cache version`, tok === "beco-v108", `states ${tok}`);
}

if (bad) process.exit(1);
writeFileSync(RECORD, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");

// The gate is the acceptance test, not this script's opinion of itself.
try {
  execFileSync(process.execPath, ["scripts/check-evidence-freshness.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (e) {
  console.error("PATCH FAILED: the corrected record does not pass the gate it feeds");
  console.error(`${e.stdout || ""}${e.stderr || ""}`);
  process.exit(1);
}
console.log(`patched ${RECORD} — measurement ${probe.measured_at}`);
console.log(`  parity claim: ${PARITY}`);
console.log(`  smoke verdict: ${smokeVerdict}`);
console.log(
  Object.entries(lens)
    .map(([f, [t, c]]) => `  ${f}: ${t.length}/${c}`)
    .join("\n"),
);
console.log(JSON.stringify(ordered.production, null, 2));
void pathToFileURL;
