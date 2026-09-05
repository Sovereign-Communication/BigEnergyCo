// Prove worker payload -> UI filter compatibility, replicating both sides exactly.
import {
  buildE1kw,
  flatProfile,
  expandProfile,
  sizeAllTiers,
  simulate,
  dailyMinimums,
} from "../assets/js/sizing/engine.js";
import { fetchHourlySeries } from "../assets/js/sizing/nasa.js";

const { hours, meta } = await fetchHourlySeries({
  latitude: 21.31,
  longitude: -157.86,
  years: 1,
});
const e1kw = buildE1kw(hours);
const loadWh = expandProfile(flatProfile(10), e1kw.length);
const tempsC = Float64Array.from(hours, (h) => h.tAmb);

// === WORKER SIDE (copied from sizing-worker.js) ===
const results = sizeAllTiers({
  e1kw,
  loadWh,
  tempsC,
  chemistry: "lfp",
  years: meta.years,
});
const historyTiers = [];
for (const { tier, sizing } of results) {
  if (!sizing) continue;
  const traced = simulate({
    pvKw: sizing.pvKw,
    battKwhUsable: sizing.battKwh,
    e1kw,
    loadWh,
    chemistry: "lfp",
    tempsC,
    capture: true,
  });
  const mins = dailyMinimums(traced.socSeries);
  let minPct = 100,
    emptyDays = 0;
  for (const v of mins) {
    const p = v * 100;
    if (p < minPct) minPct = p;
    if (p < 5) emptyDays++;
  }
  historyTiers.push({
    id: tier.id,
    dailyMin: Array.from(mins, (v) => Math.round(v * 1000) / 10),
    minPct: Math.max(0, Math.round(minPct)),
    emptyDays,
  });
}
const history = {
  startYear: meta.startYear,
  endYear: meta.endYear,
  days: Math.ceil(hours.length / 24),
  tiers: historyTiers,
};

// === UI SIDE (the exact gate drawSocChart uses) ===
const solvable = history.tiers.filter((t) => t.dailyMin && t.dailyMin.length);
console.log(
  `tiers sent: ${history.tiers.length}, pass UI filter: ${solvable.length}`,
);
if (solvable.length !== history.tiers.length || solvable.length === 0) {
  console.log("CONTRACT BROKEN");
  process.exit(1);
}
for (const t of solvable) {
  console.log(
    `OK ${t.id}: ${t.dailyMin.length} daily points, min ${Math.min(...t.dailyMin)}%, emptyDays ${t.emptyDays}`,
  );
}

// === SERVED-BYTES CHECK: does the live worker file still match this contract? ===
for (const base of [
  "https://sovereign-communication.github.io/BigEnergyCo",
  "https://bigenergyco.pages.dev",
]) {
  const w = Buffer.from(
    await (
      await fetch(base + "/assets/js/sizing/sizing-worker.js")
    ).arrayBuffer(),
  ).toString("utf8");
  console.log(
    `${base.includes("pages") ? "pages.dev " : "github.io "} serves current worker: ${w.includes("dailyMinimums(traced.socSeries)")}`,
  );
}
