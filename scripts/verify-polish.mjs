// Deep verification against PRODUCTION-served modules: download the exact
// bytes GitHub Pages serves into a temp mirror, then exercise runSizing
// end-to-end — submenus, true break-even, chart bands.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const BASE = "https://sovereign-communication.github.io/BigEnergyCo/assets/js/sizing/";
const DIR = new URL("./live-mods/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

const FILES = ["run.js", "engine.js", "nasa.js", "pricing.js", "money.js", "profiles.js"];
for (const f of FILES) {
  const res = await fetch(BASE + f + "?v=" + Date.now(), { cache: "no-store" });
  if (!res.ok) { console.error(`FAIL fetching ${f}: ${res.status}`); process.exit(1); }
  writeFileSync(DIR + f, await res.text());
}
console.log("staged production modules → verifying...\n");

const { runSizing } = await import(pathToFileURL(DIR + "run.js").href);
const { synthesizeFromProfile } = await import(pathToFileURL(DIR + "nasa.js").href);
const { OFFLINE_PROFILES } = await import(pathToFileURL(DIR + "profiles.js").href);
const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));

const fakeWeather = async () => ({
  hours: synthesizeFromProfile(honolulu),
  meta: { latitude: 21.31, longitude: -157.86, startYear: 2025, endYear: 2025, years: 1, source: "live-check", offline: false },
});

const MSG = { latitude: 21.31, longitude: -157.86, dailyKwh: 10, tariff: 0.42 };
let fails = 0;
const check = (name, ok) => { console.log((ok ? "OK    " : "FAIL  ") + name); if (!ok) fails++; };

const auto99 = await runSizing({ ...MSG, chemistry: "auto", mode: "offgrid" }, { fetchWeather: fakeWeather });
const agm99 = auto99.auto.find((a) => a.chemistry === "agm");
const lfp99 = auto99.auto.find((a) => a.chemistry === "lfp");
check(`true break-even present (AGM=${agm99.trueBreakEvenYear}, LFP=${lfp99.trueBreakEvenYear})`,
  auto99.auto.every((a) => a.trueBreakEvenYear === null || a.trueBreakEvenYear >= 1));
check("AGM never beats LFP on true break-even",
  agm99.trueBreakEvenYear === null ? lfp99.trueBreakEvenYear !== null
    : lfp99.trueBreakEvenYear === null ? false : agm99.trueBreakEvenYear > lfp99.trueBreakEvenYear);
check("autoNote reflects default 99% basis", auto99.autoNote.includes("99%"));
check("chart bands vary by chemistry (AGM top ≤55%, LFP ≥85%)",
  Math.max(...agm99.socNameplatePct.max) <= 55 && Math.max(...lfp99.socNameplatePct.max) >= 85);

const auto100 = await runSizing({ ...MSG, chemistry: "auto", mode: "offgrid", autoTier: "tier100" }, { fetchWeather: fakeWeather });
check("tier100 → all banks zero unmet hours", auto100.auto.every((a) => a.unmetHoursPerYear === 0));
check("tier100 note updated", auto100.autoNote.includes("100%"));
const hw = (x) => x.pvKw + x.battKwh / 5;
check("tier100 hardware ≥ tier99 per chemistry", ["naion", "lfp", "agm"].every((c) => {
  const a = auto100.auto.find((x) => x.chemistry === c), b = auto99.auto.find((x) => x.chemistry === c);
  return !a || !b || hw(a) >= hw(b) - 1e-9;
}));

const gtAuto60 = await runSizing({ ...MSG, chemistry: "auto", mode: "gridtie", autoTargetId: "cut60" }, { fetchWeather: fakeWeather });
check("cut60 basis applied to all chemistries", gtAuto60.auto.every((a) => a.cutPct >= 58 && a.cutPct <= 64));
check("gridtie autoNote reflects cut60", gtAuto60.autoNote.includes("60%"));

const spec = await runSizing({ ...MSG, chemistry: "agm", mode: "offgrid" }, { fetchWeather: fakeWeather });
const t100 = spec.tiers.find((t) => t.id === "tier100");
check("AGM tier100 first-cost payback present", Number.isFinite(t100.paybackYearsLo));
check("AGM tier100 true break-even later-or-never",
  t100.trueBreakEvenYear === null ? true : t100.trueBreakEvenYear >= Math.round(t100.paybackYearsLo));

// ── Pass 2: full functional matrix ─────────────────────────────────────────
check("contract version pinned (3) on every payload shape", [auto99, auto100, gtAuto60, spec].every((p) => p.contract === 3));

// specific grid-tie with feed-in: export value + break-even coexist
const gtSpec = await runSizing({ ...MSG, chemistry: "lfp", mode: "gridtie", exportRate: 0.10 }, { fetchWeather: fakeWeather });
check("gridtie specific: every solvable target carries break-even",
  gtSpec.targets.filter((t) => t.solvable).every((t) => typeof t.trueBreakEvenYear === "number" || t.trueBreakEvenYear === null));
check("gridtie specific: export credited on clipped sun",
  gtSpec.targets.some((t) => t.solvable && t.exportValueAnnualUsd > 0));

// offline fallback through the PRODUCTION default path: kill global fetch,
// run with no injected deps, confirm bundled-profile rescue + flags.
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("network down"); };
let offline;
try {
  offline = await runSizing({ ...MSG, chemistry: "auto", mode: "offgrid" });
} finally {
  globalThis.fetch = realFetch;
}
check("offline fallback engages + flags itself", offline.meta.offline === true && !!offline.meta.offlineCity);
check("offline payload still meets contract", offline.contract === 3 && offline.auto.length >= 2);
check("offline results carry honest labeling", offline.assumptions.offline === true);

// sodium-specific off-grid: LFP-settings reality visible in numbers
const naionSpec = await runSizing({ ...MSG, chemistry: "naion", mode: "offgrid" }, { fetchWeather: fakeWeather });
const naion99 = naionSpec.tiers.find((t) => t.id === "tier99");
const lfpSpec = await runSizing({ ...MSG, chemistry: "lfp", mode: "offgrid" }, { fetchWeather: fakeWeather });
const lfp99b = lfpSpec.tiers.find((t) => t.id === "tier99");
check("sodium needs ≥ nameplate of LFP for same job (0.85 capacity scale)",
  naion99.battNameplateKwh >= lfp99b.battNameplateKwh - 0.05);

console.log(fails ? `\n${fails} FAILURE(S)` : "\nALL DEEP LIVE CHECKS PASSED");
process.exit(fails ? 1 : 0);
